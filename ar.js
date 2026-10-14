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
//   3. Con esa matriz se coloca en three.js el modelo del equipo, de frente
//      y centrado sobre el logo: un diorama .glb si el equipo tiene `model`
//      en data.js, o un trofeo generado por código mientras no lo tenga.
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
    let renderer, scene, camera, anchor, content, canvasEl, resizeObs, clock, mixer = null, clipActions = [];
    let controller = null, postMatrices = [], inputW = 0, inputH = 0;
    let currentIndex = -1, spinTarget = null;
    let logoPose, poseRot, poseScale;
    // Ancho del trofeo (en sus propias unidades) que equivale al ancho del
    // logo: con 2.1 el trofeo mide ~1.4 veces el logo, igual que con los QR.
    const TROPHY_WIDTH = 2.1;
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
      logoPose = new THREE.Matrix4();
      poseRot = new THREE.Quaternion();
      poseScale = new THREE.Vector3();

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(3, 5, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.6);
      fill.position.set(-2, 1, 5);
      scene.add(fill);

      // El ancla toma de MindAR solo la posición y el tamaño del logo, no su
      // inclinación: el modelo se ve siempre de frente y derecho, centrado
      // sobre el logo y escalado a su ancho (como en la versión con QR).
      anchor = new THREE.Group();
      anchor.visible = false;
      scene.add(anchor);
      content = new THREE.Group();
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
      if (mixer) { mixer.stopAllAction(); mixer = null; clipActions = []; }
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
        positions[i * 3 + 2] = Math.sin(a) * r - 0.5;
      }
      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: teamColor, size: 0.05, transparent: true, opacity: 0.9 })));

      // Gira todo el conjunto (trofeo, placa y chispas); la placa es un
      // Sprite, así que el logo siempre queda de frente.
      return { object: g, spin: g };
    }

    function loadModel(url) {
      if (!modelCache.has(url)) {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const p = loader.loadAsync(url).then((gltf) => {
          // Normaliza: centrado en el origen y con el mismo ancho que el
          // trofeo (TROPHY_WIDTH), para que se vea igual de grande sobre el logo.
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const holder = new THREE.Group();
          root.position.copy(center).negate();
          holder.add(root);
          holder.scale.setScalar(TROPHY_WIDTH / Math.max(size.x, size.z, 1e-6));
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
            clipActions = animations.map((clip) => mixer.clipAction(clip));
            clipActions.forEach((a) => a.play());
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
        // Tras la postMatrix el logo ocupa x,y ∈ [-0.5, 0.5]: la traslación es
        // su centro y la escala, su ancho en unidades del mundo.
        logoPose.fromArray(worldMatrix).multiply(postMatrices[targetIndex]);
        logoPose.decompose(anchor.position, poseRot, poseScale);
        anchor.scale.setScalar(poseScale.x / TROPHY_WIDTH);
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
      stopFx();
      currentIndex = index;
      currentTeam = team;
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
      document.getElementById("arTools").hidden = false;
    }

    function resetFound() {
      stopFx();
      currentIndex = -1;
      currentTeam = null;
      if (anchor) anchor.visible = false;
      if (content) clearContent();
      if (camEl) camEl.classList.remove("found", "error");
      if (infoCard) infoCard.hidden = true;
      const tools = document.getElementById("arTools");
      if (tools) tools.hidden = true;
      setStatus(controller ? "Apunta la cámara al logo de un equipo…" : "Iniciando cámara…");
    }

    /* ---- Acciones de los botones de la ventana AR ---- */

    let currentTeam = null;
    // Efectos en curso; cada uno lleva su tiempo transcurrido `t` (segundos).
    let fxSpin = null, fxDance = null, fxParty = null;
    let liveTimer = null, audioCtx = null, bannerTimer = null;

    // Sonidos cortos generados con WebAudio (no requieren archivos).
    function tone(freq, start, dur, type, vol) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, audioCtx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + start);
      o.stop(audioCtx.currentTime + start + dur + 0.02);
    }
    function sound(kind) {
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
        if (kind === "party") [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, "triangle", 0.14));
        else if (kind === "run") { tone(988, 0, 0.12, "square", 0.06); tone(1319, 0.1, 0.18, "square", 0.06); }
        else tone(880, 0, 0.07, "sine", 0.1);
      } catch { /* sin audio */ }
    }

    function setToolActive(action, on) {
      const b = document.querySelector(`[data-ar-action="${action}"]`);
      if (b) b.classList.toggle("active", on);
    }

    function openPanel(html, action) {
      closePanel();
      document.getElementById("arPanelBody").innerHTML = html;
      document.getElementById("arPanel").hidden = false;
      document.getElementById("arPanel").dataset.action = action;
      setToolActive(action, true);
    }
    function closePanel() {
      const panel = document.getElementById("arPanel");
      if (!panel) return;
      if (panel.dataset.action) setToolActive(panel.dataset.action, false);
      panel.dataset.action = "";
      panel.hidden = true;
      document.getElementById("arPanelBody").innerHTML = ""; // detiene el video de YouTube
      if (window.speechSynthesis) speechSynthesis.cancel();
      clearInterval(liveTimer);
      liveTimer = null;
    }

    // Información: el modelo da una vuelta de 360° mientras aparece la ficha
    // del equipo y se narra en voz alta.
    function actionInfo(team) {
      const player = (PLAYERS[team.id] || [])[0];
      const narration = `${team.name} de ${team.city}, también conocidos como ${team.nickname}. ` +
        `Juegan de local en el ${team.stadium}, con capacidad para ${team.capacity}.` +
        (player ? ` Su jugador destacado es ${player.name}, en la posición de ${player.pos}.` : "");
      openPanel(`
        <span class="ar-panel-tag">INFORMACIÓN</span>
        <h4>${team.name}</h4>
        <dl>
          <dt>Ciudad</dt><dd>${team.city}</dd>
          <dt>Apodo</dt><dd>${team.nickname}</dd>
          <dt>Estadio</dt><dd>${team.stadium}</dd>
          <dt>Capacidad</dt><dd>${team.capacity}</dd>
          ${player ? `<dt>Destacado</dt><dd>${player.name} (${player.pos})</dd>` : ""}
        </dl>
        <div class="speaking" id="arSpeaking"></div>`, "info");
      fxSpin = { t: 0, from: content.rotation.y };
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        const u = new SpeechSynthesisUtterance(narration);
        u.lang = "es-MX";
        const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("es"));
        if (voice) u.voice = voice;
        u.rate = 1.02;
        const label = document.getElementById("arSpeaking");
        u.onstart = () => { if (label) label.textContent = "🔊 Narrando…"; };
        u.onend = () => { if (label) label.textContent = ""; };
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    }

    // Animación: el modelo "baila" (salta, se balancea y se estira).
    function actionDance() {
      fxDance = { t: 0 };
      setToolActive("dance", true);
      clipActions.forEach((a) => { a.reset(); a.play(); });
    }

    // Celebración: confeti 3D con los colores del equipo, luces de colores
    // girando alrededor del modelo y un banner en pantalla.
    function actionParty(team) {
      endParty();
      const COUNT = 160;
      const colors = [new THREE.Color(team.color), new THREE.Color(0xffd54a), new THREE.Color(0xffffff), new THREE.Color(0x2ecc3e)];
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.15),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }), COUNT);
      const parts = [];
      for (let i = 0; i < COUNT; i++) {
        const a = Math.random() * Math.PI * 2, up = 2.5 + Math.random() * 3.5, out = 1 + Math.random() * 2.2;
        parts.push({
          p: new THREE.Vector3(0, 0.6, 0.3),
          v: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out * 0.6 + 0.6),
          r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
          w: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
        });
        mesh.setColorAt(i, colors[i % colors.length]);
      }
      anchor.add(mesh);

      const lights = [new THREE.PointLight(team.color, 2, 0, 0), new THREE.PointLight(0xffd54a, 2, 0, 0)];
      lights.forEach((l) => anchor.add(l));
      fxParty = { t: 0, mesh, parts, lights, dummy: new THREE.Object3D() };
      setToolActive("party", true);

      const banner = document.getElementById("arBanner");
      banner.textContent = `¡VAMOS ${team.name.toUpperCase()}!`;
      banner.style.setProperty("--banner", team.color);
      banner.hidden = true;
      void banner.offsetWidth; // reinicia la animación CSS
      banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { banner.hidden = true; }, 2900);
      if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    }
    function endParty() {
      if (!fxParty) return;
      fxParty.mesh.parent?.remove(fxParty.mesh);
      fxParty.mesh.geometry.dispose();
      fxParty.mesh.material.dispose();
      fxParty.lights.forEach((l) => l.parent?.remove(l));
      fxParty = null;
      setToolActive("party", false);
    }

    // Video: reproduce dentro de la ventana AR un video de la liga, de
    // preferencia uno donde aparezca el equipo.
    function actionVideo(team) {
      const all = [...VIDEOS.informativos, ...VIDEOS.liga];
      const idx = TEAMS.findIndex(t => t.id === team.id);
      const v = all.find(x => x.title.includes(team.name)) || all[idx % all.length];
      const id = (v.youtube.match(/[?&]v=([\w-]{6,})/) || [])[1];
      openPanel(`
        <span class="ar-panel-tag">VIDEO</span>
        <h4>${v.title}</h4>
        <div class="ar-video-frame">
          <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1"
            allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${v.title}"></iframe>
        </div>`, "video");
    }

    // Marcador en vivo (simulado para el prototipo): se actualiza cada 2.5 s.
    function actionLive(team) {
      const game = SCHEDULE.flatMap(d => d.games).find(g => g.a === team.name || g.b === team.name);
      const rival = game ? (game.a === team.name ? game.b : game.a) : TEAMS.find(t => t.id !== team.id).name;
      const g = { inning: 1, top: true, outs: 0, onBase: 0, runs: { a: 0, b: 0 } };
      openPanel(`
        <span class="ar-panel-tag live">● EN VIVO · simulado</span>
        <div class="ar-score">
          <div class="team">${team.name}</div><div></div><div class="team">${rival}</div>
          <div class="runs" id="arRunsA">0</div><div style="color:#aab">VS</div><div class="runs" id="arRunsB">0</div>
        </div>
        <div class="ar-score-meta"><span id="arInning">▲ 1ª entrada</span><span id="arBases">En base: 0</span><span class="outs" id="arOuts">Outs <i></i><i></i><i></i></span></div>
        <div class="ar-play" id="arPlay">¡Playball!</div>`, "live");

      const PLAYS = [
        ["Ponche", "out"], ["Elevado al jardín central", "out"], ["Rola al cuadro", "out"],
        ["Sencillo al jardín derecho", "on"], ["Base por bolas", "on"], ["Doble por la línea", "on"],
        ["¡Carrera anotada!", "run"], ["¡JONRÓN! ⚾", "run"],
      ];
      liveTimer = setInterval(() => {
        const [text, kind] = PLAYS[Math.floor(Math.random() * PLAYS.length)];
        const side = g.top ? "b" : "a"; // en la alta batea el visitante (rival)
        const batting = g.top ? rival : team.name;
        let scored = 0;
        if (kind === "out") g.outs++;
        if (kind === "on") {
          if (g.onBase === 3) scored = 1; // casa llena: entra la del tercero
          else g.onBase++;
        }
        if (kind === "run") {
          // Jonrón: anotan los corredores en base y el bateador.
          scored = text.includes("JONRÓN") ? g.onBase + 1 : 1;
          if (text.includes("JONRÓN")) g.onBase = 0;
          else g.onBase = Math.max(0, g.onBase - 1);
        }
        if (scored) {
          g.runs[side] += scored;
          const el = document.getElementById(side === "a" ? "arRunsA" : "arRunsB");
          el.textContent = g.runs[side];
          el.classList.add("bump");
          setTimeout(() => el.classList.remove("bump"), 250);
          sound("run");
        }
        document.getElementById("arPlay").textContent = `${batting}: ${text}`;
        if (g.outs >= 3) {
          g.outs = 0;
          g.onBase = 0;
          if (!g.top) g.inning = g.inning % 9 + 1;
          g.top = !g.top;
        }
        document.getElementById("arInning").textContent = `${g.top ? "▲" : "▼"} ${g.inning}ª entrada`;
        document.getElementById("arBases").textContent = `En base: ${g.onBase}`;
        document.querySelectorAll("#arOuts i").forEach((d, i) => d.classList.toggle("on", i < g.outs));
      }, 2500);
    }

    function runAction(action) {
      if (!currentTeam || !anchor) return;
      const panel = document.getElementById("arPanel");
      // Volver a tocar el botón del panel abierto lo cierra.
      if (!panel.hidden && panel.dataset.action === action) { closePanel(); sound(); return; }
      if (action === "party") sound("party"); else sound();
      if (action === "info") { actionInfo(currentTeam); toast("Información del equipo 🔊"); }
      else if (action === "dance") { actionDance(); toast("¡A bailar! 💃"); }
      else if (action === "party") { actionParty(currentTeam); toast("¡Celebración! 🎉"); }
      else if (action === "video") { actionVideo(currentTeam); toast("Reproduciendo video 🎬"); }
      else if (action === "live") { actionLive(currentTeam); toast("Marcador en vivo 📊"); }
    }

    function stopFx() {
      closePanel();
      endParty();
      fxSpin = fxDance = null;
      setToolActive("dance", false);
      if (content) { content.rotation.set(0, 0, 0); content.position.set(0, 0, 0); content.scale.set(1, 1, 1); }
      const banner = document.getElementById("arBanner");
      if (banner) banner.hidden = true;
    }

    const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

    function updateFx(dt) {
      if (!content) return;
      if (fxSpin) {
        fxSpin.t += dt;
        const k = Math.min(fxSpin.t / 2.6, 1);
        content.rotation.y = fxSpin.from + easeInOut(k) * Math.PI * 2;
        if (k >= 1) { content.rotation.y = fxSpin.from; fxSpin = null; }
      }
      if (fxDance) {
        fxDance.t += dt;
        const t = fxDance.t, beat = t * Math.PI * 2 * 1.6;
        content.position.y = Math.abs(Math.sin(beat / 2)) * 0.55;
        content.rotation.z = Math.sin(beat / 2) * 0.28;
        const squash = 1 + Math.sin(beat) * 0.08;
        content.scale.set(1 / squash, squash, 1 / squash);
        if (t > 3.2) {
          fxDance = null;
          content.position.y = 0; content.rotation.z = 0; content.scale.set(1, 1, 1);
          setToolActive("dance", false);
        }
      }
      if (fxParty) {
        const P = fxParty;
        P.t += dt;
        P.parts.forEach((q, i) => {
          q.v.y -= 5.5 * dt;
          q.v.multiplyScalar(0.985);
          q.p.addScaledVector(q.v, dt);
          q.r.x += q.w.x * dt; q.r.y += q.w.y * dt; q.r.z += q.w.z * dt;
          P.dummy.position.copy(q.p);
          P.dummy.rotation.copy(q.r);
          P.dummy.updateMatrix();
          P.mesh.setMatrixAt(i, P.dummy.matrix);
        });
        P.mesh.instanceMatrix.needsUpdate = true;
        P.mesh.material.opacity = Math.max(0, 1 - Math.max(0, P.t - 2.4) / 0.8);
        P.lights.forEach((l, i) => {
          const a = P.t * 4 + i * Math.PI;
          l.position.set(Math.cos(a) * 1.8, 0.6 + Math.sin(P.t * 6 + i) * 0.5, Math.sin(a) * 1.8 + 0.8);
          l.intensity = 1.6 + Math.sin(P.t * 18 + i * 2) * 1.2;
        });
        if (P.t > 3.2) endParty();
      }
    }

    function renderLoop() {
      const dt = clock ? Math.min(clock.getDelta(), 0.1) : 0;
      if (mixer) mixer.update(dt);
      if (spinTarget) spinTarget.rotation.y += dt * 0.6;
      updateFx(dt);
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
      stopTracking(); // p. ej. el reconocimiento de una foto subida antes
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
      stopFx();
      currentTeam = null;
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

    // "Escanear otro": con una foto subida se regresa a la cámara (si no, el
    // mismo logo de la foto se volvería a detectar al instante).
    function rescan() {
      if (stillImg && !stillImg.hidden) start();
      else resetFound();
    }

    return { start, stop, scanFile, rescan, runAction, closePanel };
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
    if (e.target.id === "arRescanBtn") { Live.rescan(); return; }
    if (e.target.id === "arPanelClose") { Live.closePanel(); return; }
    const tool = e.target.closest("[data-ar-action]");
    if (tool) Live.runAction(tool.dataset.arAction);
  });

  return { renderTargetGrid, enterLive, leaveLive };
})();
