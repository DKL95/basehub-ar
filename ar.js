// Experiencia de Realidad Aumentada de Base-Hub.
//
// Flujo real (no simulado):
//   1. ar-select muestra los códigos QR de cada equipo (Assets/qr/<id>.png,
//      generados a partir de data.js — ver Assets/qr/manifest.json). Cada
//      código codifica el texto "BASEHUB:TEAM:<id>".
//   2. ar-live pide la cámara del teléfono (getUserMedia) y la deja
//      encendida todo el tiempo que el usuario esté en esta pantalla —
//      nunca se apaga sola al reconocer un código. En cada cuadro de video
//      se decodifica el QR con jsQR, que además de identificar al equipo
//      devuelve las 4 esquinas del código en la imagen.
//   3. Con esas esquinas calculamos, cada cuadro, en qué punto de la
//      pantalla está el QR y a qué distancia aparenta estar (por su
//      tamaño), y ahí mismo — sobre el propio QR, en vivo — dibujamos con
//      three.js (WebGL) un trofeo 3D del equipo detectado: esa es la
//      "cámara pasa a través + objeto anclado" que da la sensación de
//      Realidad Aumentada. Si el QR sale un instante del cuadro, el
//      modelo se queda congelado donde estaba en vez de desaparecer.
//
// Requiere que jsQR y THREE (three.js) estén cargados por <script> antes de
// este archivo; si el CDN no está disponible, la app se degrada con
// elegancia (cámara + info del equipo, sin el modelo 3D) en vez de romperse.

const Ar = (() => {

  /* ---------------- Selección: grid de códigos QR + lightbox ---------------- */

  function renderQrGrid() {
    const grid = document.getElementById("arQrGrid");
    if (!grid) return;
    grid.innerHTML = TEAMS.map(t => `
      <div class="qr-tile" data-qr-team="${t.id}">
        <img src="Assets/qr/${t.id}.png" alt="Código QR de ${t.name}" loading="lazy" />
        <span>${t.name}</span>
      </div>`).join("");
  }

  function openLightbox(teamId) {
    const t = TEAMS.find(x => x.id === teamId);
    if (!t) return;
    document.getElementById("qrLightboxImg").src = `Assets/qr/${t.id}.png`;
    document.getElementById("qrLightboxName").textContent = t.name;
    document.getElementById("qrLightbox").classList.add("show");
  }
  function closeLightbox() {
    document.getElementById("qrLightbox").classList.remove("show");
  }

  document.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-qr-team]");
    if (tile) { openLightbox(tile.dataset.qrTeam); return; }
    if (e.target.id === "qrLightboxClose" || e.target.id === "qrLightbox") closeLightbox();
  });

  /* ---------------- AR en vivo: cámara + jsQR + modelo anclado ---------------- */

  const Live = (() => {
    // Ancho "natural" (en unidades del mundo 3D) al que el trofeo se ve a
    // escala 1. Se ajustó a ojo para que el tamaño del modelo acompañe al
    // tamaño real del QR en cámara. Rango de escala acotado para que nunca
    // se vea absurdamente grande o diminuto si la detección tiembla.
    const BASE_WIDTH = 2.1;
    const MIN_SCALE = 0.35, MAX_SCALE = 3;

    let video, stillImg, canvas, ctx, statusEl, camEl, infoCard, infoName, infoSub, infoStats;
    let stream = null, requestId = 0, rafId = null;
    let renderer, scene, camera, group, canvasEl, resizeObs;
    let trackingLive = false, currentTeamId = null, hasModel = false;
    let objectUrl = null;

    function setStatus(msg, isError) {
      if (statusEl) statusEl.textContent = msg || "";
      if (camEl) camEl.classList.toggle("error", !!isError);
    }

    // Los QR de Base-Hub codifican "BASEHUB:TEAM:<id>"; cualquier otro
    // código (ajeno a la app) se reporta como no reconocido.
    function decodePayload(text) {
      const m = /^BASEHUB:TEAM:([a-z0-9-]+)$/i.exec((text || "").trim());
      if (!m) return null;
      const team = TEAMS.find(t => t.id === m[1].toLowerCase());
      return team ? team.id : null;
    }

    /* ---- three.js: escena persistente + contenido del equipo ---- */

    function ensureScene() {
      if (renderer) return true;
      canvasEl = document.getElementById("arStage3d");
      if (!canvasEl || typeof THREE === "undefined") return false;

      renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      if (THREE.ACESFilmicToneMapping) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
      }

      scene = new THREE.Scene();
      // Cámara mirando derecho al eje -Z, sin inclinación: así el mapeo de
      // "punto en pantalla" -> "punto en el mundo" es simple y predecible.
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(3, 5, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.6);
      fill.position.set(-2, 1, 5);
      scene.add(fill);

      group = new THREE.Group();
      group.visible = false;
      scene.add(group);

      resize();
      if (window.ResizeObserver) {
        resizeObs = new ResizeObserver(resize);
        resizeObs.observe(canvasEl.parentElement);
      } else {
        window.addEventListener("resize", resize);
      }
      return true;
    }

    function resize() {
      if (!renderer || !canvasEl || !canvasEl.parentElement) return;
      const w = canvasEl.parentElement.clientWidth;
      const h = canvasEl.parentElement.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function disposeChild(obj) {
      if (obj.geometry && !obj.isSprite) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    }

    // Reconstruye el contenido del grupo (trofeo + placa + chispas) para el
    // equipo dado. El grupo en sí se conserva: solo cambian sus hijos, así
    // no hay que recrear cámara/escena/renderer al cambiar de equipo.
    function populateGroup(team) {
      while (group.children.length) disposeChild(group.children.pop());

      const teamColor = new THREE.Color(team.color);
      const metalColor = teamColor.clone().lerp(new THREE.Color(0xffffff), 0.32);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.3, 0.28, 40),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.35 })
      );
      base.position.y = -1.15;
      group.add(base);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.85, 20),
        new THREE.MeshStandardMaterial({ color: metalColor, metalness: 0.6, roughness: 0.3 })
      );
      stem.position.y = -0.68;
      group.add(stem);

      const cup = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62),
        new THREE.MeshStandardMaterial({ color: metalColor, metalness: 0.55, roughness: 0.28, side: THREE.DoubleSide })
      );
      cup.rotation.x = Math.PI;
      cup.position.y = 0.2;
      group.add(cup);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.98, 0.05, 14, 48),
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 })
      );
      ring.rotation.x = Math.PI / 2.3;
      ring.position.y = 0.25;
      group.add(ring);

      // Placa con el logo: Sprite (siempre de cara a la cámara), hijo del
      // grupo para heredar su posición/escala (que siguen al QR) sin
      // heredar su rotación propia (el logo nunca queda "de canto").
      const badgeMat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true });
      const badge = new THREE.Sprite(badgeMat);
      badge.scale.set(1.1, 1.1, 1);
      badge.position.set(0, 1.15, 0);
      group.add(badge);
      new THREE.TextureLoader().load(team.logo, (tex) => {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        badgeMat.map = tex;
        badgeMat.needsUpdate = true;
      });

      const sparkCount = 50;
      const positions = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.7 + Math.random() * 1.2;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
        positions[i * 3 + 2] = Math.sin(a) * r - 0.5;
      }
      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: teamColor, size: 0.05, transparent: true, opacity: 0.9 }));
      group.add(sparks);
    }

    function disposeScene() {
      if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
      window.removeEventListener("resize", resize);
      if (scene) {
        scene.traverse((obj) => {
          if (obj.geometry && !obj.isSprite) obj.geometry.dispose();
          if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        });
      }
      if (renderer) renderer.dispose();
      renderer = scene = camera = group = canvasEl = null;
    }

    /* ---- Anclaje: de "esquinas del QR en la imagen" a "posición en pantalla" ---- */

    // Replica el mapeo que hace CSS object-fit:cover entre el cuadro
    // analizado (tamaño srcW×srcH) y la caja donde se ve en pantalla.
    function coverMap(px, py, srcW, srcH, dispW, dispH) {
      const scale = Math.max(dispW / srcW, dispH / srcH);
      const offX = (dispW - srcW * scale) / 2;
      const offY = (dispH - srcH * scale) / 2;
      return { x: px * scale + offX, y: py * scale + offY };
    }

    function displayToNdc(px, py, dispW, dispH) {
      return { x: (px / dispW) * 2 - 1, y: -(py / dispH) * 2 + 1 };
    }

    // Convierte un punto en coordenadas de pantalla (NDC) al punto del
    // plano z=0 del mundo 3D que le corresponde bajo la cámara actual.
    function screenToWorldAtZ0(ndcX, ndcY) {
      const near = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
      const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
      const dir = far.clone().sub(near).normalize();
      const t = -near.z / dir.z;
      return near.add(dir.multiplyScalar(t));
    }

    function placeGroupFromQr(location, srcW, srcH) {
      if (!group || !canvasEl) return;
      const dispW = canvasEl.clientWidth, dispH = canvasEl.clientHeight;
      if (!dispW || !dispH) return;

      const keys = ["topLeftCorner", "topRightCorner", "bottomRightCorner", "bottomLeftCorner"];
      const world = keys.map((k) => {
        const p = coverMap(location[k].x, location[k].y, srcW, srcH, dispW, dispH);
        const ndc = displayToNdc(p.x, p.y, dispW, dispH);
        return screenToWorldAtZ0(ndc.x, ndc.y);
      });

      const cx = (world[0].x + world[1].x + world[2].x + world[3].x) / 4;
      const cy = (world[0].y + world[1].y + world[2].y + world[3].y) / 4;
      const widthTop = world[0].distanceTo(world[1]);
      const widthBottom = world[3].distanceTo(world[2]);
      const worldWidth = (widthTop + widthBottom) / 2;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, worldWidth / BASE_WIDTH));

      group.position.set(cx, cy, 0);
      group.scale.setScalar(scale);
      group.visible = true;
    }

    /* ---- Ciclo de cámara + decodificación + render ---- */

    function switchTeam(teamId) {
      currentTeamId = teamId;
      hasModel = true;
      camEl.classList.add("found");
      if (ensureScene()) populateGroup(TEAMS.find((t) => t.id === teamId));
      showInfo(TEAMS.find((t) => t.id === teamId));
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
      currentTeamId = null;
      hasModel = false;
      if (group) group.visible = false;
      if (camEl) camEl.classList.remove("found", "error");
      if (infoCard) infoCard.hidden = true;
      setStatus(trackingLive ? "Buscando código QR…" : "Iniciando cámara…");
    }

    function renderFrame() {
      if (group && group.visible) group.rotation.y += 0.01;
      if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function tick() {
      if (trackingLive && video && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
        if (code) {
          const teamId = decodePayload(code.data);
          if (teamId) {
            if (teamId !== currentTeamId) switchTeam(teamId);
            placeGroupFromQr(code.location, canvas.width, canvas.height);
            setStatus("");
          } else if (!hasModel) {
            setStatus("Código QR no reconocido. Prueba con uno de Base-Hub.");
          }
        }
        // Si no se detectó código en este cuadro, no tocamos el grupo: se
        // queda congelado en su última posición en vez de desaparecer.
      }
      renderFrame();
      rafId = requestAnimationFrame(tick);
    }

    async function start() {
      video = document.getElementById("arVideo");
      stillImg = document.getElementById("arStillImg");
      canvas = document.getElementById("arScanCanvas");
      ctx = canvas.getContext("2d", { willReadFrequently: true });
      statusEl = document.getElementById("arScanStatus");
      camEl = document.getElementById("arCam");
      infoCard = document.getElementById("arInfoCard");
      infoName = document.getElementById("arInfoName");
      infoSub = document.getElementById("arInfoSub");
      infoStats = document.getElementById("arInfoStats");

      stillImg.hidden = true;
      video.hidden = false;
      trackingLive = false;
      resetFound();
      ensureScene();
      if (!rafId) rafId = requestAnimationFrame(tick);

      const myId = ++requestId;

      if (typeof jsQR !== "function") {
        setStatus("No se pudo cargar el lector de QR (revisa tu conexión). Usa 'Subir foto'.", true);
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("Este navegador no permite acceso a la cámara. Usa 'Subir foto'.", true);
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        // El usuario pudo haber salido de la pantalla mientras esperábamos
        // el permiso: si ya no somos la petición vigente, soltamos la
        // cámara de inmediato en vez de dejarla encendida de fondo.
        if (myId !== requestId) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream = s;
        video.srcObject = stream;
        await video.play();
        if (myId !== requestId) { stop(); return; }
        trackingLive = true;
        setStatus("Buscando código QR…");
      } catch (err) {
        if (myId !== requestId) return;
        const msg = err && err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador o usa 'Subir foto'."
          : "No se pudo acceder a la cámara. Usa 'Subir foto'.";
        setStatus(msg, true);
      }
    }

    function stop() {
      requestId++; // invalida cualquier start() en curso esperando permiso
      trackingLive = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
      if (video) video.srcObject = null;
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      disposeScene();
      currentTeamId = null;
      hasModel = false;
    }

    // Alternativa sin cámara: decodifica el QR en una foto subida y ancla
    // el modelo sobre su posición dentro de esa foto (que pasa a mostrarse
    // como fondo, igual que haría el video en vivo).
    function scanFile(file) {
      setStatus("Analizando imagen…");
      if (camEl) camEl.classList.remove("error");
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const cctx = c.getContext("2d");
        cctx.drawImage(img, 0, 0);
        const frame = cctx.getImageData(0, 0, c.width, c.height);
        const code = typeof jsQR === "function" ? jsQR(frame.data, frame.width, frame.height) : null;
        const teamId = code ? decodePayload(code.data) : null;
        if (teamId) {
          trackingLive = false;
          video.hidden = true;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = url;
          stillImg.src = url;
          stillImg.hidden = false;
          switchTeam(teamId);
          if (renderer) placeGroupFromQr(code.location, c.width, c.height);
          if (!rafId) rafId = requestAnimationFrame(tick);
        } else {
          URL.revokeObjectURL(url);
          setStatus("No se encontró un código QR de Base-Hub válido en esa imagen.", true);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); setStatus("No se pudo leer la imagen.", true); };
      img.src = url;
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

  return { renderQrGrid, enterLive, leaveLive };
})();
