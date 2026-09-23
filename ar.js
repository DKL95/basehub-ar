// Experiencia de Realidad Aumentada de Base-Hub.
//
// Flujo real (no simulado):
//   1. ar-select muestra los códigos QR de cada equipo (Assets/qr/<id>.png,
//      generados a partir de data.js — ver Assets/qr/manifest.json). Cada
//      código codifica el texto "BASEHUB:TEAM:<id>".
//   2. ar-scan pide acceso a la cámara del teléfono (getUserMedia) y decodifica
//      QR en vivo con jsQR. Si no hay cámara disponible, se puede subir una
//      foto del código como alternativa.
//   3. Al reconocer un código válido, ar-result renderiza un modelo 3D real
//      (WebGL vía three.js) del equipo detectado: un trofeo giratorio con el
//      color del equipo y su logo, más las estadísticas del roster.
//
// Requiere que jsQR y THREE (three.js) estén cargados por <script> antes de
// este archivo; si el CDN no está disponible, la pantalla lo indica con un
// mensaje claro en vez de fallar en silencio.

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

  /* ---------------- Escaneo: cámara + jsQR ---------------- */

  const Scan = (() => {
    let stream = null, rafId = null, video, canvas, ctx, statusEl, camEl, scanning = false, requestId = 0;

    function setStatus(msg, isError) {
      if (statusEl) statusEl.textContent = msg;
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

    function tick() {
      if (!scanning) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
        if (code) {
          const teamId = decodePayload(code.data);
          if (teamId) { onFound(teamId); return; }
          setStatus("Código QR no reconocido. Prueba con uno de Base-Hub.");
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    function onFound(teamId) {
      scanning = false;
      setStatus("¡Código detectado!");
      if (navigator.vibrate) navigator.vibrate(80);
      stop();
      state.currentTeam = teamId;
      setTimeout(() => goTo("ar-result"), 250);
    }

    async function start() {
      const myId = ++requestId;
      video = document.getElementById("arVideo");
      canvas = document.getElementById("arScanCanvas");
      statusEl = document.getElementById("arScanStatus");
      camEl = document.getElementById("arCam");
      ctx = canvas.getContext("2d", { willReadFrequently: true });
      setStatus("Iniciando cámara…");

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
        // El usuario pudo haber salido de la pantalla de escaneo mientras
        // esperábamos el permiso: si ya no somos la petición vigente,
        // liberamos la cámara de inmediato en vez de dejarla encendida.
        if (myId !== requestId) { s.getTracks().forEach(tr => tr.stop()); return; }
        stream = s;
        video.srcObject = stream;
        await video.play();
        if (myId !== requestId) { stop(); return; }
        scanning = true;
        setStatus("Buscando código QR…");
        rafId = requestAnimationFrame(tick);
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
      scanning = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (stream) { stream.getTracks().forEach(tr => tr.stop()); stream = null; }
      if (video) video.srcObject = null;
    }

    function scanFile(file) {
      setStatus("Analizando imagen…");
      if (camEl) camEl.classList.remove("error");
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const cctx = c.getContext("2d");
        cctx.drawImage(img, 0, 0);
        const frame = cctx.getImageData(0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const code = typeof jsQR === "function" ? jsQR(frame.data, frame.width, frame.height) : null;
        const teamId = code ? decodePayload(code.data) : null;
        if (teamId) onFound(teamId);
        else setStatus("No se encontró un código QR de Base-Hub válido en esa imagen.", true);
      };
      img.onerror = () => setStatus("No se pudo leer la imagen.", true);
      img.src = url;
    }

    return { start, stop, scanFile };
  })();

  function enterScan() { Scan.start(); }
  function leaveScan() { Scan.stop(); }

  document.addEventListener("change", (e) => {
    if (e.target.id === "arFileInput" && e.target.files && e.target.files[0]) {
      Scan.scanFile(e.target.files[0]);
      e.target.value = "";
    }
  });

  /* ---------------- Resultado: modelo 3D con three.js ---------------- */

  const Stage3D = (() => {
    let renderer, scene, camera, group, sparks, badge, rafId, canvasEl, resizeObs, t = 0;

    function build(team) {
      dispose();
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
      camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      camera.position.set(0, 0.45, 5.6);
      camera.lookAt(0, 0.15, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const key = new THREE.DirectionalLight(0xffffff, 1.3);
      key.position.set(3, 5, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.7);
      fill.position.set(-2, 1, 5);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(new THREE.Color(team.color), 1.6);
      rim.position.set(-4, -1, -3);
      scene.add(rim);

      group = new THREE.Group();
      scene.add(group);
      const teamColor = new THREE.Color(team.color);
      // Versión aclarada del color del equipo: los colores muy oscuros (azul
      // marino, negro) se verían casi negros como metal bajo esta luz.
      const metalColor = teamColor.clone().lerp(new THREE.Color(0xffffff), 0.32);

      // Base del trofeo
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.3, 0.28, 48),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.35 })
      );
      base.position.y = -1.55;
      group.add(base);

      // Vástago
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 1.1, 24),
        new THREE.MeshStandardMaterial({ color: metalColor, metalness: 0.6, roughness: 0.3 })
      );
      stem.position.y = -0.9;
      group.add(stem);

      // Copa (media esfera estilo pelota de beisbol gigante)
      const cup = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.62),
        new THREE.MeshStandardMaterial({ color: metalColor, metalness: 0.55, roughness: 0.28, side: THREE.DoubleSide })
      );
      cup.rotation.x = Math.PI;
      cup.position.y = 0.25;
      group.add(cup);

      // Costura tipo pelota
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.98, 0.05, 16, 60),
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 })
      );
      ring.rotation.x = Math.PI / 2.3;
      ring.position.y = 0.3;
      group.add(ring);

      // Placa con el logo del equipo: es un sprite (no una malla dentro del
      // grupo giratorio) para que siempre mire hacia la cámara, sin importar
      // cómo rote el trofeo.
      const badgeMat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true });
      badge = new THREE.Sprite(badgeMat);
      badge.scale.set(1.15, 1.15, 1);
      badge.position.set(0, 1.55, 0);
      scene.add(badge);
      new THREE.TextureLoader().load(team.logo, (tex) => {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        badgeMat.map = tex;
        badgeMat.needsUpdate = true;
      });

      // Chispas de acento alrededor del trofeo
      const sparkCount = 60;
      const positions = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.8 + Math.random() * 1.4;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 3.4;
        positions[i * 3 + 2] = Math.sin(a) * r - 0.5;
      }
      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: teamColor, size: 0.05, transparent: true, opacity: 0.9 }));
      scene.add(sparks);

      resize();
      if (window.ResizeObserver) {
        resizeObs = new ResizeObserver(resize);
        resizeObs.observe(canvasEl.parentElement);
      } else {
        window.addEventListener("resize", resize);
      }

      t = 0;
      loop();
      return true;
    }

    function loop() {
      t += 0.012;
      if (group) {
        group.rotation.y += 0.012;
        group.position.y = Math.sin(t * 1.3) * 0.08;
      }
      if (badge) badge.position.y = 1.55 + Math.sin(t * 1.3) * 0.08;
      if (sparks) sparks.rotation.y -= 0.003;
      if (renderer && scene && camera) renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
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

    function dispose() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
      window.removeEventListener("resize", resize);
      if (scene) {
        scene.traverse(obj => {
          // Sprite usa una geometría interna compartida entre todas las
          // instancias de three.js: nunca hay que liberarla, o rompería el
          // siguiente modelo 3D que se construya.
          if (obj.geometry && !obj.isSprite) obj.geometry.dispose();
          if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        });
      }
      if (renderer) renderer.dispose();
      renderer = scene = camera = group = sparks = badge = canvasEl = null;
    }

    return { build, dispose };
  })();

  function renderResult(teamId) {
    if (!teamId) teamId = TEAMS[0].id;
    const team = TEAMS.find(t => t.id === teamId) || TEAMS[0];
    const player = (PLAYERS[team.id] || [])[0];
    const statEntries = player ? Object.entries(player.season).slice(0, 4) : [];
    document.getElementById("arResultBody").innerHTML = `
      <div class="stage" style="background:radial-gradient(circle at 50% 30%, ${team.color}, #05070a 80%);">
        <canvas id="arStage3d"></canvas>
      </div>
      <h3 style="margin:6px 0 2px;">${team.name}</h3>
      <p style="color:#666;font-size:12.5px;margin:0 0 4px;">${team.stadium} · ${team.city}</p>
      ${player ? `<p style="font-weight:700;margin:6px 0 2px;">${player.name} — ${player.pos}</p>` : ""}
      <div class="stat-strip">
        ${statEntries.map(([k, v]) => `<div class="stat-chip"><b>${v}</b>${k}</div>`).join("")}
      </div>
      <div style="margin-top:22px;display:flex;gap:10px;justify-content:center;">
        <button class="btn ghost" data-nav="ar-select">Escanear otro código</button>
        <button class="btn" data-nav="jugadores">Ver plantilla</button>
      </div>`;

    const ok = Stage3D.build(team);
    if (!ok) {
      // Sin WebGL/three.js disponible: degradamos con elegancia al logo.
      document.querySelector("#arResultBody .stage").innerHTML =
        `<img class="glow-player" src="${team.logo}" alt="${team.name}" />`;
    }
  }

  function leaveResult() { Stage3D.dispose(); }

  return { renderQrGrid, enterScan, leaveScan, renderResult, leaveResult };
})();
