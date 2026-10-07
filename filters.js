// Motor de video y filtros de procesamiento de imagen para la Galería.
// Cada cuadro del video se dibuja en un canvas y se procesa píxel por píxel
// (getImageData/putImageData), así los filtros funcionan igual en Android y
// iOS (Safari no soporta ctx.filter). Si el video no tiene archivo propio se
// usa una escena animada procedural como respaldo.

// Catálogo de filtros: la interfaz (botones y sliders) se arma a partir de aquí.
const FILTERS = [
  { id: "none",     label: "Original",          controls: [] },
  { id: "blur",     label: "Desenfoque",        controls: [{ key: "radius", label: "Radio de desenfoque", min: 1, max: 20, value: 6 }] },
  { id: "pixelate", label: "Pixelado",          controls: [{ key: "block", label: "Tamaño de bloque", min: 2, max: 40, value: 12 }] },
  { id: "thermal",  label: "Cámara térmica",    controls: [{ key: "contrast", label: "Sensibilidad térmica", min: 50, max: 250, value: 130, unit: "%" }] },
  { id: "color",    label: "Ajuste de color",   controls: [
      { key: "hue", label: "Tono", min: -180, max: 180, value: 40, unit: "°" },
      { key: "sat", label: "Saturación", min: 0, max: 200, value: 120, unit: "%" },
      { key: "temp", label: "Temperatura (frío ↔ cálido)", min: -60, max: 60, value: 0 },
    ] },
  { id: "pastel",   label: "Colores pastel",    controls: [{ key: "amount", label: "Intensidad pastel", min: 0, max: 100, value: 60, unit: "%" }] },
  { id: "vivid",    label: "Alta saturación",   controls: [{ key: "amount", label: "Saturación extra", min: 0, max: 200, value: 120, unit: "%" }] },
  { id: "smooth",   label: "Suavizado",         controls: [
      { key: "radius", label: "Radio de suavizado", min: 1, max: 12, value: 4 },
      { key: "amount", label: "Mezcla", min: 0, max: 100, value: 70, unit: "%" },
    ] },
];

const VideoFilters = (() => {
  const MAX_SIDE = 640; // resolución de procesamiento (rendimiento en móviles)

  let canvas, ctx, off, offCtx, W, H, hue, rafId, video = null;
  let mode = "none", params = {}, showOriginal = false;
  let t = 0;
  let tmp = null; // buffer reutilizable para el desenfoque (se crea al usarse)

  /* ---------- Fuente: video real o escena procedural ---------- */
  function init(targetCanvas, videoHue, src) {
    stop();
    canvas = targetCanvas;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    hue = videoHue || 140;
    off = document.createElement("canvas");
    offCtx = off.getContext("2d", { willReadFrequently: true });
    t = 0;
    setMode("none");

    if (src) {
      video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.crossOrigin = "anonymous";
      video.addEventListener("loadedmetadata", () => {
        resize(video.videoWidth, video.videoHeight);
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => { video = null; resize(360, 640); }, { once: true });
      resize(360, 640);
    } else {
      video = null;
      resize(360, 640);
    }
    loop();
  }

  function resize(vw, vh) {
    const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh));
    W = Math.round(vw * scale); H = Math.round(vh * scale);
    canvas.width = off.width = W;
    canvas.height = off.height = H;
    if (canvas.parentElement) canvas.parentElement.style.aspectRatio = `${W} / ${H}`;
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); video = null; }
  }

  function setMode(m) {
    mode = m;
    params = {};
    const f = FILTERS.find(x => x.id === m);
    if (f) f.controls.forEach(c => { params[c.key] = c.value; });
  }
  function setParam(key, value) { params[key] = value; }
  function setShowOriginal(v) { showOriginal = v; }
  function togglePlay() {
    if (!video) return null;
    if (video.paused) video.play().catch(() => {}); else video.pause();
    return !video.paused;
  }

  // Escena procedural con movimiento (respaldo cuando no hay archivo de video).
  function drawScene(c, w, h, time, baseHue) {
    const sky = c.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, `hsl(${baseHue + 20},70%,55%)`);
    sky.addColorStop(1, `hsl(${baseHue},55%,40%)`);
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h * 0.62);

    for (let i = 0; i < 4; i++) {
      const x = (w / 5) * (i + 1);
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.beginPath();
      c.arc(x, h * 0.08, 6, 0, Math.PI * 2);
      c.fill();
    }

    const grass = c.createLinearGradient(0, h * 0.6, 0, h);
    grass.addColorStop(0, "#3f9b3f");
    grass.addColorStop(1, "#1f6b1f");
    c.fillStyle = grass;
    c.fillRect(0, h * 0.6, w, h * 0.4);

    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2, h * 0.62);
    c.lineTo(w * 0.08, h);
    c.moveTo(w / 2, h * 0.62);
    c.lineTo(w * 0.92, h);
    c.stroke();

    const bx = w / 2 + Math.sin(time / 500) * (w * 0.28);
    const by = h * 0.62 - Math.abs(Math.cos(time / 420)) * (h * 0.32) - 10;
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(bx, by, 9, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#c0392b";
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(bx, by, 9, 0.3, 2.1);
    c.stroke();

    c.fillStyle = "rgba(10,10,10,0.85)";
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.88, 30, 46, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "rgba(0,0,0,0.45)";
    c.fillRect(10, 10, 74, 22);
    c.fillStyle = "#fff";
    c.font = "12px sans-serif";
    c.fillText("● BASE-HUB", 16, 25);
  }

  /* ---------- Filtros ---------- */

  // Pixelado: reduce la imagen y la vuelve a ampliar sin suavizado.
  function pixelate(blockSize) {
    const bs = Math.max(2, blockSize);
    const sw = Math.max(1, Math.floor(W / bs));
    const sh = Math.max(1, Math.floor(H / bs));
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0, W, H, 0, 0, sw, sh);
    ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  }

  // Desenfoque de caja separable (horizontal + vertical) con suma móvil:
  // el costo no depende del radio. 3 pasadas aproximan un desenfoque gaussiano.
  function boxBlurPass(src, dst, w, h, r, horizontal) {
    const outer = horizontal ? h : w;
    const inner = horizontal ? w : h;
    const step = horizontal ? 4 : w * 4;
    const norm = 1 / (r * 2 + 1);
    for (let o = 0; o < outer; o++) {
      const base = horizontal ? o * w * 4 : o * 4;
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) {
          const i = Math.min(inner - 1, Math.max(0, k));
          sum += src[base + i * step + ch];
        }
        for (let i = 0; i < inner; i++) {
          dst[base + i * step + ch] = sum * norm;
          const add = Math.min(inner - 1, i + r + 1);
          const sub = Math.max(0, i - r);
          sum += src[base + add * step + ch] - src[base + sub * step + ch];
        }
      }
    }
  }
  function blur(data, w, h, r, passes) {
    if (!tmp || tmp.length < data.length) tmp = new Uint8ClampedArray(data.length);
    for (let p = 0; p < passes; p++) {
      boxBlurPass(data, tmp, w, h, r, true);
      boxBlurPass(tmp, data, w, h, r, false);
    }
  }

  // Desenfoca a media resolución y reescala con interpolación: el resultado
  // es prácticamente igual y procesa 4 veces menos píxeles (clave en móviles).
  let half = null, halfCtx = null;
  function blurredFrame(radius, passes) {
    const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1);
    if (!half) { half = document.createElement("canvas"); halfCtx = half.getContext("2d", { willReadFrequently: true }); }
    if (half.width !== hw || half.height !== hh) { half.width = hw; half.height = hh; }
    halfCtx.drawImage(off, 0, 0, hw, hh);
    const img = halfCtx.getImageData(0, 0, hw, hh);
    blur(img.data, hw, hh, Math.max(1, Math.round(radius / 2)), passes);
    halfCtx.putImageData(img, 0, 0);
    return half;
  }

  // Paleta térmica: negro → azul → morado → rojo → naranja → amarillo → blanco.
  const THERMAL_LUT = (() => {
    const stops = [[0, 0, 0, 0], [0.18, 20, 0, 140], [0.38, 140, 0, 160], [0.58, 230, 30, 40], [0.75, 255, 140, 0], [0.9, 255, 230, 40], [1, 255, 255, 255]];
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      let s = 0;
      while (s < stops.length - 2 && v > stops[s + 1][0]) s++;
      const [p0, r0, g0, b0] = stops[s], [p1, r1, g1, b1] = stops[s + 1];
      const k = (v - p0) / (p1 - p0);
      lut[i * 3] = r0 + (r1 - r0) * k;
      lut[i * 3 + 1] = g0 + (g1 - g0) * k;
      lut[i * 3 + 2] = b0 + (b1 - b0) * k;
    }
    return lut;
  })();
  function thermal(d, contrastPct) {
    const k = contrastPct / 100;
    for (let i = 0; i < d.length; i += 4) {
      let v = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
      v = Math.min(255, Math.max(0, (v - 128) * k + 128)) | 0;
      d[i] = THERMAL_LUT[v * 3];
      d[i + 1] = THERMAL_LUT[v * 3 + 1];
      d[i + 2] = THERMAL_LUT[v * 3 + 2];
    }
  }

  // Matriz 3x3 de color: rotación de tono × saturación (mismas fórmulas que
  // los filtros hue-rotate/saturate de CSS, pero aplicadas por píxel).
  function colorMatrix(hueDeg, sat) {
    const a = hueDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const h = [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    ];
    const S = [
      0.213 + 0.787 * sat, 0.715 - 0.715 * sat, 0.072 - 0.072 * sat,
      0.213 - 0.213 * sat, 0.715 + 0.285 * sat, 0.072 - 0.072 * sat,
      0.213 - 0.213 * sat, 0.715 - 0.715 * sat, 0.072 + 0.928 * sat,
    ];
    const m = new Array(9);
    for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
      m[r * 3 + col] = S[r * 3] * h[col] + S[r * 3 + 1] * h[3 + col] + S[r * 3 + 2] * h[6 + col];
    }
    return m;
  }
  function applyMatrix(d, m, addR, addB) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = m[0] * r + m[1] * g + m[2] * b + addR;
      d[i + 1] = m[3] * r + m[4] * g + m[5] * b;
      d[i + 2] = m[6] * r + m[7] * g + m[8] * b + addB;
    }
  }

  // Pastel: baja la saturación y mezcla los colores con un tono crema claro.
  function pastel(d, amountPct) {
    const k = amountPct / 100;
    applyMatrix(d, colorMatrix(0, 1 - 0.45 * k), 0, 0);
    const mix = 0.42 * k, cr = 255 * mix, cg = 244 * mix, cb = 250 * mix, keep = 1 - mix;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] * keep + cr;
      d[i + 1] = d[i + 1] * keep + cg;
      d[i + 2] = d[i + 2] * keep + cb;
    }
  }

  // Alta saturación: satura y aplica una curva en S suave para dar "punch".
  const S_CURVE = (() => {
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      lut[i] = 255 * (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)) * 0.35 + i * 0.65;
    }
    return lut;
  })();
  function vivid(d, amountPct) {
    applyMatrix(d, colorMatrix(0, 1 + amountPct / 100), 0, 0);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = S_CURVE[d[i]]; d[i + 1] = S_CURVE[d[i + 1]]; d[i + 2] = S_CURVE[d[i + 2]];
    }
  }

  // Suavizado: mezcla la imagen original con una versión desenfocada
  // (efecto "soft focus", reduce ruido y textura).
  let scratch = null, scratchCtx = null;
  function smooth(d, radius, amountPct) {
    if (!scratch) { scratch = document.createElement("canvas"); scratchCtx = scratch.getContext("2d", { willReadFrequently: true }); }
    if (scratch.width !== W || scratch.height !== H) { scratch.width = W; scratch.height = H; }
    scratchCtx.drawImage(blurredFrame(radius, 2), 0, 0, W, H);
    const b = scratchCtx.getImageData(0, 0, W, H).data;
    const k = amountPct / 100, keep = 1 - k;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] * keep + b[i] * k;
      d[i + 1] = d[i + 1] * keep + b[i + 1] * k;
      d[i + 2] = d[i + 2] * keep + b[i + 2] * k;
    }
  }

  /* ---------- Render ---------- */
  function render() {
    t += 16;
    if (video && video.readyState >= 2) offCtx.drawImage(video, 0, 0, W, H);
    else if (!video) drawScene(offCtx, W, H, t, hue);

    if (showOriginal || mode === "none") {
      ctx.drawImage(off, 0, 0);
      return;
    }
    if (mode === "pixelate") {
      pixelate(params.block);
      return;
    }
    if (mode === "blur") {
      ctx.drawImage(blurredFrame(params.radius, 3), 0, 0, W, H);
      return;
    }

    const img = offCtx.getImageData(0, 0, W, H);
    const d = img.data;
    switch (mode) {
      case "thermal": thermal(d, params.contrast); break;
      case "color": applyMatrix(d, colorMatrix(params.hue, params.sat / 100), params.temp, -params.temp); break;
      case "pastel": pastel(d, params.amount); break;
      case "vivid": vivid(d, params.amount); break;
      case "smooth": smooth(d, params.radius, params.amount); break;
    }
    ctx.putImageData(img, 0, 0);
  }

  function loop() {
    render();
    rafId = requestAnimationFrame(loop);
  }

  return { init, stop, setMode, setParam, setShowOriginal, togglePlay, hasVideo: () => !!video };
})();
