// Insignias 3D de las trivias (three.js r160, en vendor/). Cada insignia es
// una medalla de metal (oro, plata o bronce según el mejor puntaje; gris si
// está bloqueada) con un emblema en relieve: pelota, bates, trofeo, estrella,
// home, diamante, corona, gorra o rayo. Al reverso lleva el nombre grabado.
//
// Se usa un solo WebGLRenderer para todo (los navegadores limitan los
// contextos WebGL): las miniaturas de la Galería se renderizan a imagen y la
// vista 3D interactiva usa ese mismo lienzo dentro de un visor modal.
// app.js carga este módulo con import() la primera vez que hace falta.

import * as THREE from "three";

const TIERS = {
  oro: { color: 0xe8b84a, metalness: 1, roughness: 0.22 },
  plata: { color: 0xd8dde3, metalness: 1, roughness: 0.2 },
  bronce: { color: 0xc27c47, metalness: 1, roughness: 0.3 },
  bloqueada: { color: 0x7d838a, metalness: 0.35, roughness: 0.65 },
};
const ENAMEL = ["#1b3a6b", "#0f6b4f", "#8e1f2f", "#4a2a7a", "#0d5c75", "#1f2937", "#7a3e0e", "#0b4f2b", "#5b1a4a", "#123b52"];

let renderer, scene, camera, envTex;
const thumbCache = new Map();

function init() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 5.4);

  // Entorno para los reflejos del metal: un cuarto gris con paneles de luz.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x3a3d44, side: THREE.BackSide })));
  const panel = (w, h, pos, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(6, 2, new THREE.Vector3(0, 4.9, 0), 6);
  panel(3, 4, new THREE.Vector3(-4.9, 1, 2), 4);
  panel(3, 3, new THREE.Vector3(4.9, -1, 3), 2.5);
  panel(4, 2, new THREE.Vector3(0, 1, 4.9), 3);
  envTex = pmrem.fromScene(room, 0.03).texture;
  scene.environment = envTex;

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 3, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));
}

/* ---------------- Modelo ---------------- */

function metal(tier) {
  const t = TIERS[tier];
  return new THREE.MeshStandardMaterial({ color: t.color, metalness: t.metalness, roughness: t.roughness });
}

function extrude(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24 });
  g.center();
  return g;
}

function polyShape(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

// Costura de una pelota de béisbol sobre una esfera de radio r.
function seamCurve(r) {
  const pts = [];
  const a = 0.75, b = 0.25, c = 2 * Math.sqrt(a * b);
  for (let i = 0; i <= 200; i++) {
    const t = (i / 200) * Math.PI * 2;
    const v = new THREE.Vector3(a * Math.cos(t) + b * Math.cos(3 * t), a * Math.sin(t) - b * Math.sin(3 * t), c * Math.sin(2 * t));
    pts.push(v.normalize().multiplyScalar(r * 1.01));
  }
  return new THREE.CatmullRomCurve3(pts, true);
}

function ballMesh(r, locked) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshStandardMaterial({ color: locked ? 0x9a9fa6 : 0xf6f1e6, roughness: 0.55 })));
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve(r), 240, r * 0.04, 8, true), new THREE.MeshStandardMaterial({ color: locked ? 0x5d6168 : 0xc8202c, roughness: 0.5 }));
  g.add(seam);
  g.rotation.set(0.5, 0.6, 0.2);
  return g;
}

function batMesh(locked) {
  const profile = [
    [0.0, -0.78], [0.075, -0.78], [0.08, -0.74], [0.035, -0.71], [0.03, -0.2],
    [0.05, 0.1], [0.08, 0.45], [0.085, 0.66], [0.07, 0.74], [0.0, 0.76],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.Mesh(new THREE.LatheGeometry(profile, 32),
    new THREE.MeshStandardMaterial({ color: locked ? 0x8d9299 : 0xb5793f, roughness: 0.45, metalness: 0.05 }));
}

function emblem(type, tier, accent) {
  const locked = tier === "bloqueada";
  const m = metal(tier);
  const white = new THREE.MeshStandardMaterial({ color: locked ? 0xa5aab0 : 0xf4f4f4, roughness: 0.35 });
  const g = new THREE.Group();

  switch (type) {
    case "ball":
      g.add(ballMesh(0.5, locked));
      g.position.z = 0.2;
      break;
    case "bats": {
      const b1 = batMesh(locked), b2 = batMesh(locked);
      b1.rotation.z = 0.7; b2.rotation.z = -0.7;
      b1.position.z = 0.02; b2.position.z = 0.1;
      const ball = ballMesh(0.2, locked);
      ball.position.set(0, -0.32, 0.2);
      g.add(b1, b2, ball);
      g.position.z = 0.12;
      break;
    }
    case "trophy": {
      const cup = [
        [0, -0.55], [0.34, -0.55], [0.34, -0.47], [0.12, -0.43], [0.06, -0.18], [0.1, -0.08],
        [0.36, 0.12], [0.42, 0.52], [0.38, 0.52], [0.33, 0.16], [0, 0.0],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const body = new THREE.Mesh(new THREE.LatheGeometry(cup, 48), m);
      body.material.side = THREE.DoubleSide;
      const handleGeo = new THREE.TorusGeometry(0.16, 0.035, 12, 32, Math.PI);
      const h1 = new THREE.Mesh(handleGeo, m); h1.position.set(0.42, 0.3, 0); h1.rotation.z = -Math.PI / 2;
      const h2 = new THREE.Mesh(handleGeo, m); h2.position.set(-0.42, 0.3, 0); h2.rotation.z = Math.PI / 2;
      g.add(body, h1, h2);
      g.scale.set(1, 1, 0.5);
      g.position.z = 0.22;
      break;
    }
    case "star": {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.27 : 0.64, a = Math.PI / 2 + (i * Math.PI) / 5;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      g.add(new THREE.Mesh(extrude(polyShape(pts), 0.1, 0.05), m));
      g.position.z = 0.17;
      break;
    }
    case "plate":
      g.add(new THREE.Mesh(extrude(polyShape([[-0.45, 0.38], [0.45, 0.38], [0.45, -0.05], [0, -0.5], [-0.45, -0.05]]), 0.08, 0.04), white));
      g.position.z = 0.15;
      break;
    case "diamond": {
      const outer = polyShape([[0, 0.62], [0.62, 0], [0, -0.62], [-0.62, 0]]);
      outer.holes.push(polyShape([[0, 0.46], [-0.46, 0], [0, -0.46], [0.46, 0]]));
      g.add(new THREE.Mesh(extrude(outer, 0.08, 0.03), m));
      [[0, 0.56], [0.56, 0], [0, -0.56], [-0.56, 0]].forEach(([x, y]) => {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.1), white);
        base.position.set(x, y, 0.06);
        base.rotation.z = Math.PI / 4;
        g.add(base);
      });
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m);
      mound.rotation.x = Math.PI / 2;
      g.add(mound);
      g.position.z = 0.15;
      break;
    }
    case "crown": {
      const crown = polyShape([[-0.55, -0.38], [0.55, -0.38], [0.55, 0.4], [0.28, 0.06], [0, 0.5], [-0.28, 0.06], [-0.55, 0.4]]);
      g.add(new THREE.Mesh(extrude(crown, 0.1, 0.04), m));
      const jewel = new THREE.MeshStandardMaterial({ color: locked ? 0x6b7077 : 0xd0263a, roughness: 0.15, metalness: 0.2 });
      [[-0.55, 0.44], [0, 0.55], [0.55, 0.44]].forEach(([x, y]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), jewel);
        s.position.set(x, y - 0.06, 0.02);
        g.add(s);
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), jewel);
      gem.position.set(0, -0.16, 0.1);
      g.add(gem);
      g.position.z = 0.17;
      break;
    }
    case "cap": {
      const fabric = new THREE.MeshStandardMaterial({ color: locked ? 0x8d9299 : accent, roughness: 0.7 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), fabric);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 40), fabric);
      brim.scale.set(1.25, 1, 0.75);
      brim.position.set(0.42, 0.0, 0);
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), m);
      button.position.y = 0.42;
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 10, 48), m);
      band.rotation.x = Math.PI / 2;
      g.add(dome, brim, button, band);
      g.rotation.set(0.25, -0.5, 0);
      g.scale.set(1, 1, 0.7);
      g.position.set(-0.08, -0.12, 0.1);
      break;
    }
    case "bolt":
    default:
      g.add(new THREE.Mesh(extrude(polyShape([[0.12, 0.62], [-0.36, -0.04], [-0.03, -0.04], [-0.16, -0.62], [0.36, 0.1], [0.03, 0.1]]), 0.1, 0.04), m));
      g.position.z = 0.17;
      break;
  }
  return g;
}

// Reverso: nombre de la insignia grabado.
function backTexture(name, tier) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#" + TIERS[tier].color.toString(16).padStart(6, "0");
  x.fillRect(0, 0, 512, 512);
  x.fillStyle = "rgba(0,0,0,.55)";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = "bold 46px system-ui, sans-serif";
  x.fillText("BASE-HUB", 256, 170);
  let size = 64;
  x.font = `900 ${size}px system-ui, sans-serif`;
  while (x.measureText(name).width > 400 && size > 30) x.font = `900 ${(size -= 4)}px system-ui, sans-serif`;
  x.fillText(name.toUpperCase(), 256, 266);
  x.font = "bold 40px system-ui, sans-serif";
  x.fillText(tier === "bloqueada" ? "BLOQUEADA" : tier.toUpperCase(), 256, 352);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildMedal({ emblem: type, tier, accentIndex, name }) {
  const medal = new THREE.Group();
  const m = metal(tier);
  const accent = tier === "bloqueada" ? "#3d4147" : ENAMEL[accentIndex % ENAMEL.length];

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 96), m);
  disc.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 20, 120), m);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.035, 14, 120), m);
  innerRing.position.z = 0.08;
  const enamel = new THREE.Mesh(new THREE.CircleGeometry(0.82, 96),
    new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
  enamel.position.z = 0.082;
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.92, 96),
    new THREE.MeshStandardMaterial({ map: backTexture(name, tier), metalness: 0.6, roughness: 0.35 }));
  back.position.z = -0.081;
  back.rotation.y = Math.PI;
  // Argolla superior.
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 12, 32), m);
  loop.position.y = 1.15;

  medal.add(disc, rim, innerRing, enamel, back, loop, emblem(type, tier, accent));
  return medal;
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

/* ---------------- Miniaturas ---------------- */

// Devuelve un dataURL PNG de la insignia (en caché por emblema/nivel/color).
export function thumb(opts, size = 192) {
  init();
  const key = `${opts.emblem}|${opts.tier}|${opts.accentIndex}|${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const wasViewing = viewer.open;
  const medal = buildMedal(opts);
  medal.rotation.set(0.12, -0.38, 0);
  scene.add(medal);
  if (wasViewing) viewer.medal.visible = false;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  scene.remove(medal);
  disposeTree(medal);
  if (wasViewing) { viewer.medal.visible = true; sizeViewer(); }
  thumbCache.set(key, url);
  return url;
}

/* ---------------- Visor 3D interactivo ---------------- */

const viewer = { open: false, medal: null, raf: 0, rotY: 0, rotX: 0.1, vel: 0.012, drag: null };

function sizeViewer() {
  const box = document.getElementById("badgeViewerStage");
  const w = box.clientWidth, h = box.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loop() {
  if (!viewer.open) return;
  if (!viewer.drag) {
    viewer.rotY += viewer.vel;
    viewer.vel += (0.012 - viewer.vel) * 0.02; // vuelve poco a poco al giro lento
    viewer.rotX += (0.1 - viewer.rotX) * 0.05;
  }
  viewer.medal.rotation.set(viewer.rotX, viewer.rotY, 0);
  viewer.medal.position.y = Math.sin(performance.now() / 700) * 0.04;
  renderer.render(scene, camera);
  viewer.raf = requestAnimationFrame(loop);
}

function ensureViewerDom() {
  let el = document.getElementById("badgeViewer");
  if (el) return el;
  el = document.createElement("div");
  el.id = "badgeViewer";
  el.className = "badge-viewer";
  el.innerHTML = `
    <div class="badge-viewer-inner">
      <div class="badge-viewer-stage" id="badgeViewerStage"></div>
      <div class="badge-viewer-name" id="badgeViewerName"></div>
      <div class="badge-viewer-sub" id="badgeViewerSub"></div>
      <div class="badge-viewer-hint">Arrastra para girarla</div>
      <div class="badge-viewer-actions" id="badgeViewerActions"></div>
    </div>`;
  (document.querySelector(".phone") || document.body).appendChild(el);
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-viewer-close]")) close(); });

  const stage = el.querySelector("#badgeViewerStage");
  stage.addEventListener("pointerdown", (e) => {
    viewer.drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!viewer.drag) return;
    const dx = e.clientX - viewer.drag.x, dy = e.clientY - viewer.drag.y;
    const dt = Math.max(1, performance.now() - viewer.drag.t);
    viewer.rotY += dx * 0.012;
    viewer.rotX = Math.max(-0.8, Math.min(0.8, viewer.rotX + dy * 0.008));
    viewer.vel = (dx * 0.012) / dt * 16;
    viewer.drag = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  const end = () => { viewer.drag = null; };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  window.addEventListener("resize", () => { if (viewer.open) sizeViewer(); });
  return el;
}

// Abre el visor con la insignia girando. actionsHTML: botones extra opcionales.
export function open(opts, info) {
  init();
  const el = ensureViewerDom();
  close(true);
  el.querySelector("#badgeViewerName").textContent = info.title;
  el.querySelector("#badgeViewerSub").textContent = info.subtitle || "";
  el.querySelector("#badgeViewerActions").innerHTML = (info.actionsHTML || "") + `<button class="btn ghost" data-viewer-close>Cerrar</button>`;
  el.querySelector("#badgeViewerStage").appendChild(renderer.domElement);
  el.classList.add("open");

  viewer.medal = buildMedal(opts);
  scene.add(viewer.medal);
  viewer.rotY = -0.6;
  viewer.rotX = 0.1;
  viewer.vel = 0.15; // entra girando rápido
  viewer.open = true;
  sizeViewer();
  loop();
}

export function close(silent) {
  if (!viewer.open) return;
  viewer.open = false;
  cancelAnimationFrame(viewer.raf);
  scene.remove(viewer.medal);
  disposeTree(viewer.medal);
  viewer.medal = null;
  if (!silent) document.getElementById("badgeViewer")?.classList.remove("open");
}
