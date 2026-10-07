// Experiencia de Realidad Aumentada de Base-Hub.
//
// Flujo:
//   1. ar-select muestra los logos de los equipos (Assets/targets/<id>.png):
//      son las imágenes "marcador" que se imprimen o se muestran en otra
//      pantalla para escanearlas.
//   2. ar-live enciende la cámara y la pasa a MindAR, que reconoce el logo
//      por sus puntos característicos (no por un código) y calcula, cuadro a
//      cuadro, su posición y orientación en 3D. Las huellas de los logos están
//      precompiladas en Assets/targets/targets.mind (orden en targets.json).
//   3. Con esa matriz se coloca en three.js el modelo del equipo parado sobre
//      el logo: un diorama .glb si el equipo tiene `model` en data.js, o un
//      trofeo generado por código mientras no lo tenga.
//
// Las librerías (three.js, GLTFLoader, MindAR) viven en vendor/ y se cargan
// con import() solo al entrar a la cámara (ver ar-libs.js).

const Ar = (() => {
  const TARGETS_MIND = "Assets/targets/targets.mind";
  const TARGETS_ORDER = "Assets/targets/targets.json";

  /* ---------------- Selección: grid de logos + lightbox ---------------- */

  function renderTargetGrid() {
    const grid = document.getElementById("arTargetGrid");
    if (!grid) return;
    grid.innerHTML = TEAMS.map(t => `
      <div class="qr-tile" data-target-team="${t.id}">
        <img src="Assets/targets/${t.id}.png" alt="Logo de ${t.name}" loading="lazy" />
        <span>${t.name}</span>
      </div>`).join("");
  }

  function openLightbox(teamId) {
    const t = TEAMS.find(x => x.id === teamId);
    if (!t) return;
    document.getElementById("qrLightboxImg").src = `Assets/targets/${t.id}.png`;
    document.getElementById("qrLightboxName").textContent = t.name;
    document.getElementById("qrLightbox").classList.add("show");
  }
  function closeLightbox() {
    document.getElementById("qrLightbox").classList.remove("show");
  }

  document.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-target-team]");
    if (tile) { openLightbox(tile.dataset.targetTeam); return; }
    if (e.target.id === "qrLightboxClose" || e.target.id === "qrLightbox") closeLightbox();
  });

  /* ---------------- AR en vivo: cámara + MindAR + modelo anclado ---------------- */

  const Live = (() => {
    let THREE, GLTFLoader, MeshoptDecoder, Controller;
    let libsPromise = null, targetIds = null;

    let video, stillImg, scanCanvas, statusEl, camEl, infoCard, infoName, infoSub, infoStats;
    let stream = null, requestId = 0, rafId = null, objectUrl = null;
    let renderer, scene, camera, anchor, content, canvasEl, resizeObs, clock, mixer = null;
    let controller = null, postMatrices = [], inputW = 0, inputH = 0;
    let currentIndex = -1, spinTarget = null;
    const modelCache = new Map(); // url -> Promise<gltf>

    function setStatus(msg, isError) {
      if (statusEl) statusEl.textContent = msg || "";
      if (camEl) camEl.classList.toggle("error", !!isError);
    }

    function loadLibs() {
      if (!libsPromise) {
        libsPromise = Promise.all([
          import("./ar-libs.js"),
          fetch(TARGETS_ORDER).then(r => r.json()),
        ]).then(([libs, order]) => {
          ({ THREE, GLTFLoader, MeshoptDecoder, Controller } = libs);
          targetIds = order;
        }).catch((err) => { libsPromise = null; throw err; });
      }
      return libsPromise;
    }

    /* ---- three.js: escena + ancla que sigue al logo ---- */

    function ensureScene() {
      if (renderer) return;
      canvasEl = document.getElementById("arStage3d");

      renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // Fondo transparente explícito: renderer.clear() se llama antes del
      // primer render() y, sin esto, pinta el canvas de negro encima del video.
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(); // en el origen, mirando a -Z (convención de MindAR)
      clock = new THREE.Clock();

      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(1, 2, 3);
      scene.add(key);

      // El ancla recibe la matriz de MindAR. Tras multiplicar por la
      // postMatrix, el logo ocupa x,y ∈ [-0.5, 0.5] con el eje +Z saliendo de
      // la imagen. `content` gira 90° para que el "arriba" (+Y) de los modelos
      // apunte hacia afuera del logo: el diorama queda parado sobre él.
      anchor = new THREE.Group();
      anchor.matrixAutoUpdate = false;
      anchor.visible = false;
      scene.add(anchor);
      content = new THREE.Group();
      content.rotation.x = Math.PI / 2;
      anchor.add(content);

      if (window.ResizeObserver) {
        resizeObs = new ResizeObserver(fitCamera);
        resizeObs.observe(canvasEl.parentElement);
      }
    }

    // Ajusta la cámara de three.js a la proyección de MindAR, considerando
    // que el video se ve con object-fit: cover (se recorta para llenar la caja).
    function fitCamera() {
      if (!renderer || !controller) return;
      const box = canvasEl.parentElement;
      const cw = box.clientWidth, ch = box.clientHeight;
      if (!cw || !ch) return;
      const m = controller.getProjectionMatrix();
      const shownH = (inputW / inputH > cw / ch) ? ch : cw / inputW * inputH;
      camera.fov = 2 * Math.atan((1 / m[5]) * (ch / shownH)) * 180 / Math.PI;
      camera.near = m[14] / (m[10] - 1);
      camera.far = m[14] / (m[10] + 1);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch, false);
    }

    function disposeObject(obj) {
      obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        }
      });
    }

    function clearContent() {
      if (mixer) { mixer.stopAllAction(); mixer = null; }
      spinTarget = null;
      while (content.children.length) {
        const child = content.children.pop();
        // Los modelos .glb se guardan en caché para volver a mostrarlos
        // al instante; solo se liberan los generados por código.
        if (!child.userData.cached) disposeObject(child);
      }
    }

    // Trofeo generado por código (se usa mientras el equipo no tenga diorama).
    function buildTrophy(team) {
      const g = new THREE.Group();
      const teamColor = new THREE.Color(team.color);
      const metal = teamColor.clone().lerp(new THREE.Color(0xffffff), 0.32);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.28, 40),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.35 }));
      base.position.y = -1.15;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.85, 20),
        new THREE.MeshStandardMaterial({ color: metal, metalness: 0.6, roughness: 0.3 }));
      stem.position.y = -0.68;
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62),
        new THREE.MeshStandardMaterial({ color: metal, metalness: 0.55, roughness: 0.28, side: THREE.DoubleSide }));
      cup.rotation.x = Math.PI;
      cup.position.y = 0.2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.05, 14, 48),
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 }));
      ring.rotation.x = Math.PI / 2.3;
      ring.position.y = 0.25;
      g.add(base, stem, cup, ring);

      const badgeMat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true });
      const badge = new THREE.Sprite(badgeMat);
      badge.scale.set(1.1, 1.1, 1);
      badge.position.set(0, 1.15, 0);
      g.add(badge);
      new THREE.TextureLoader().load(team.logo, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        badgeMat.map = tex;
        badgeMat.needsUpdate = true;
      });

      const sparkCount = 50;
      const positions = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.7 + Math.random() * 1.2;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
        positions[i * 3 + 2] = Math.sin(a) * r;
      }
      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: teamColor, size: 0.05, transparent: true, opacity: 0.9 })));

      // El trofeo mide ~3 unidades de alto con la base en y≈-1.29: se escala
      // para medir ~0.9 veces el ancho del logo y se apoya sobre él.
      const holder = new THREE.Group();
      g.position.y = 1.29;
      holder.add(g);
      holder.scale.setScalar(0.3);
      return { object: holder, spin: g };
    }

    function loadModel(url) {
      if (!modelCache.has(url)) {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const p = loader.loadAsync(url).then((gltf) => {
          // Normaliza: centrado, base en y=0 y la huella (lo más ancho entre
          // X y Z) igual al ancho del logo.
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const holder = new THREE.Group();
          root.position.set(-center.x, -box.min.y, -center.z);
          holder.add(root);
          holder.scale.setScalar(1 / Math.max(size.x, size.z, 1e-6));
          holder.userData.cached = true;
          return { holder, animations: gltf.animations };
        });
        p.catch(() => modelCache.delete(url));
        modelCache.set(url, p);
      }
      return modelCache.get(url);
    }

    async function showTeamContent(team, index) {
      clearContent();
      if (team.model) {
        setStatus("Cargando modelo 3D…");
        try {
          const { holder, animations } = await loadModel(team.model);
          if (currentIndex !== index) return; // se cambió de logo mientras cargaba
          content.add(holder);
          if (animations.length) {
            mixer = new THREE.AnimationMixer(holder);
            animations.forEach((clip) => mixer.clipAction(clip).play());
          }
          setStatus("");
          return;
        } catch (err) {
          console.warn("No se pudo cargar el modelo", team.model, err);
          if (currentIndex !== index) return;
        }
      }
      const trophy = buildTrophy(team);
      content.add(trophy.object);
      spinTarget = trophy.spin;
      setStatus("");
    }

    function disposeScene() {
      if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
      if (content) clearContent();
      if (renderer) renderer.dispose();
      renderer = scene = camera = anchor = content = canvasEl = null;
    }

    /* ---- MindAR ---- */

    async function startTracking(sourceEl, w, h, myId) {
      inputW = w; inputH = h;
      controller = new Controller({
        inputWidth: w,
        inputHeight: h,
        maxTrack: 1,
        warmupTolerance: 3,
        missTolerance: 6,
        onUpdate: onTrackerUpdate,
      });
      const { dimensions } = await controller.addImageTargets(TARGETS_MIND);
      if (myId !== requestId) return false;
      postMatrices = dimensions.map(([mw, mh]) => new THREE.Matrix4().compose(
        new THREE.Vector3(mw / 2, mw / 2 + (mh - mw) / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(mw, mw, mw)
      ));
      fitCamera();
      await controller.dummyRun(sourceEl);
      if (myId !== requestId) return false;
      controller.processVideo(sourceEl);
      return true;
    }

    function stopTracking() {
      if (!controller) return;
      const c = controller;
      controller = null;
      c.stopProcessVideo();
      // El ciclo de MindAR termina su cuadro en curso antes de soltar recursos.
      setTimeout(() => { try { c.dispose(); } catch { /* ya liberado */ } }, 300);
    }

    function onTrackerUpdate({ type, targetIndex, worldMatrix }) {
      if (type !== "updateMatrix" || !anchor) return;
      if (worldMatrix) {
        if (targetIndex !== currentIndex) switchTeam(targetIndex);
        anchor.matrix.fromArray(worldMatrix).multiply(postMatrices[targetIndex]);
        anchor.visible = true;
        camEl.classList.add("found");
        if (statusEl.textContent === "Logo perdido: vuelve a apuntar al logo.") setStatus("");
      } else if (targetIndex === currentIndex) {
        anchor.visible = false;
        camEl.classList.remove("found");
        setStatus("Logo perdido: vuelve a apuntar al logo.");
      }
    }

    function switchTeam(index) {
      const team = TEAMS.find(t => t.id === targetIds[index]);
      if (!team) return;
      currentIndex = index;
      showTeamContent(team, index);
      showInfo(team);
      if (typeof state !== "undefined") state.currentTeam = team.id; // para "Ver plantilla"
      if (navigator.vibrate) navigator.vibrate(60);
    }

    function showInfo(team) {
      const player = (PLAYERS[team.id] || [])[0];
      infoName.textContent = team.name;
      infoSub.textContent = `${team.stadium} · ${team.city}`;
      const statEntries = player ? Object.entries(player.season).slice(0, 3) : [];
      infoStats.innerHTML = statEntries.map(([k, v]) => `<div class="stat-chip"><b>${v}</b>${k}</div>`).join("");
      infoCard.hidden = false;
    }

    function resetFound() {
      currentIndex = -1;
      if (anchor) anchor.visible = false;
      if (content) clearContent();
      if (camEl) camEl.classList.remove("found", "error");
      if (infoCard) infoCard.hidden = true;
      setStatus(controller ? "Apunta la cámara al logo de un equipo…" : "Iniciando cámara…");
    }

    function renderLoop() {
      const dt = clock ? clock.getDelta() : 0;
      if (mixer) mixer.update(dt);
      if (spinTarget) spinTarget.rotation.y += dt * 0.8;
      if (renderer && anchor && anchor.visible) renderer.render(scene, camera);
      else if (renderer) renderer.clear();
      rafId = requestAnimationFrame(renderLoop);
    }

    function grabElements() {
      video = document.getElementById("arVideo");
      stillImg = document.getElementById("arStillImg");
      scanCanvas = document.getElementById("arScanCanvas");
      statusEl = document.getElementById("arScanStatus");
      camEl = document.getElementById("arCam");
      infoCard = document.getElementById("arInfoCard");
      infoName = document.getElementById("arInfoName");
      infoSub = document.getElementById("arInfoSub");
      infoStats = document.getElementById("arInfoStats");
    }

    async function start() {
      grabElements();
      const myId = ++requestId;
      stillImg.hidden = true;
      video.hidden = false;
      resetFound();
      setStatus("Cargando motor de Realidad Aumentada…");

      try {
        await loadLibs();
      } catch {
        if (myId === requestId) setStatus("No se pudo cargar el motor de AR. Revisa tu conexión y vuelve a entrar.", true);
        return;
      }
      if (myId !== requestId) return;
      ensureScene();
      if (!rafId) rafId = requestAnimationFrame(renderLoop);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("Este navegador no permite acceso a la cámara (requiere https). Usa 'Subir foto'.", true);
        return;
      }
      setStatus("Iniciando cámara…");
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        // Si el usuario salió de la pantalla mientras se pedía el permiso,
        // se suelta la cámara de inmediato.
        if (myId !== requestId) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream = s;
        video.srcObject = stream;
        await video.play();
        if (!video.videoWidth) await new Promise(r => video.addEventListener("loadedmetadata", r, { once: true }));
        if (myId !== requestId) return;
        // MindAR lee cada cuadro con los atributos width/height del <video>
        // (no con su tamaño real): sin esto procesa imágenes vacías.
        video.width = video.videoWidth;
        video.height = video.videoHeight;
        setStatus("Preparando reconocimiento de logos…");
        if (await startTracking(video, video.videoWidth, video.videoHeight, myId)) {
          setStatus("Apunta la cámara al logo de un equipo…");
        }
      } catch (err) {
        if (myId !== requestId) return;
        const msg = err && err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador o usa 'Subir foto'."
          : "No se pudo acceder a la cámara. Usa 'Subir foto'.";
        setStatus(msg, true);
      }
    }

    function stopCamera() {
      if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
      if (video) video.srcObject = null;
    }

    function stop() {
      requestId++; // invalida cualquier start() en curso
      stopTracking();
      stopCamera();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      disposeScene();
      currentIndex = -1;
    }

    // Alternativa sin cámara: busca el logo en una foto subida y coloca el
    // modelo sobre él (la foto se muestra como fondo, igual que el video).
    async function scanFile(file) {
      grabElements();
      const myId = ++requestId;
      stopTracking();
      stopCamera();
      resetFound();
      setStatus("Analizando foto…");
      const url = URL.createObjectURL(file);
      try {
        await loadLibs();
        const img = await new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = url; });
        if (myId !== requestId) { URL.revokeObjectURL(url); return; }
        // Se reduce la foto a ~640 px: MindAR trabaja igual de bien y mucho más rápido.
        const k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
        scanCanvas.width = Math.round(img.naturalWidth * k);
        scanCanvas.height = Math.round(img.naturalHeight * k);
        // MindAR interpreta un lienzo de ancho == alto de entrada como "girado
        // 90°"; en una foto cuadrada se evita quitándole un píxel de alto.
        if (scanCanvas.width === scanCanvas.height) scanCanvas.height -= 1;
        scanCanvas.getContext("2d").drawImage(img, 0, 0, scanCanvas.width, scanCanvas.height);

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = url;
        stillImg.src = url;
        stillImg.hidden = false;
        video.hidden = true;
        ensureScene();
        if (!rafId) rafId = requestAnimationFrame(renderLoop);

        await startTracking(scanCanvas, scanCanvas.width, scanCanvas.height, myId);
        setTimeout(() => {
          if (myId === requestId && currentIndex === -1) setStatus("No se encontró el logo de un equipo en esa foto.", true);
        }, 4000);
      } catch {
        URL.revokeObjectURL(url);
        if (myId === requestId) setStatus("No se pudo leer la imagen.", true);
      }
    }

    return { start, stop, scanFile, resetFound };
  })();

  function enterLive() { Live.start(); }
  function leaveLive() { Live.stop(); }

  document.addEventListener("change", (e) => {
    if (e.target.id === "arFileInput" && e.target.files && e.target.files[0]) {
      Live.scanFile(e.target.files[0]);
      e.target.value = "";
    }
  });
  document.addEventListener("click", (e) => {
    if (e.target.id === "arRescanBtn") Live.resetFound();
  });

  return { renderTargetGrid, enterLive, leaveLive };
})();
