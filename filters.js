// Motor de "video" y filtros de procesamiento de imagen para la Galería.
// No hay archivos de video reales en el prototipo, así que generamos una
// escena animada por canvas (procedural) y le aplicamos, en vivo, los
// filtros de Pixelaje y Desenfoque pedidos en el proyecto.

const VideoFilters = (() => {
  let ctx, off, offCtx, W, H, hue, rafId, mode = "none", intensity = 10;
  let t = 0;

  function init(canvas, videoHue) {
    stop();
    ctx = canvas.getContext("2d");
    W = canvas.width; H = canvas.height;
    hue = videoHue || 140;
    off = document.createElement("canvas");
    off.width = W; off.height = H;
    offCtx = off.getContext("2d");
    mode = "none";
    t = 0;
    loop();
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setMode(m, val) {
    mode = m;
    if (val !== undefined) intensity = val;
  }
  function setIntensity(v) { intensity = v; }

  // Dibuja una escena procedural con movimiento (simula un clip de béisbol).
  function drawScene(c, w, h, time, baseHue) {
    const sky = c.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, `hsl(${baseHue + 20},70%,55%)`);
    sky.addColorStop(1, `hsl(${baseHue},55%,40%)`);
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h * 0.62);

    // sol / luces del estadio
    for (let i = 0; i < 4; i++) {
      const x = (w / 5) * (i + 1);
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.beginPath();
      c.arc(x, h * 0.08, 6, 0, Math.PI * 2);
      c.fill();
    }

    // pasto
    const grass = c.createLinearGradient(0, h * 0.6, 0, h);
    grass.addColorStop(0, "#3f9b3f");
    grass.addColorStop(1, "#1f6b1f");
    c.fillStyle = grass;
    c.fillRect(0, h * 0.6, w, h * 0.4);

    // líneas de campo
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2, h * 0.62);
    c.lineTo(w * 0.08, h);
    c.moveTo(w / 2, h * 0.62);
    c.lineTo(w * 0.92, h);
    c.stroke();

    // pelota rebotando (movimiento = "video")
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

    // jugador silueta simple
    c.fillStyle = "rgba(10,10,10,0.85)";
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.88, 30, 46, 0, 0, Math.PI * 2);
    c.fill();

    // marca de tiempo estilo "REC"
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.fillRect(10, 10, 74, 22);
    c.fillStyle = "#fff";
    c.font = "12px sans-serif";
    c.fillText("● BASE-HUB", 16, 25);
  }

  function pixelate(srcCanvas, destCtx, w, h, blockSize) {
    const bs = Math.max(2, blockSize);
    const sw = Math.max(1, Math.floor(w / bs));
    const sh = Math.max(1, Math.floor(h / bs));
    const tmp = document.createElement("canvas");
    tmp.width = sw; tmp.height = sh;
    const tmpCtx = tmp.getContext("2d");
    tmpCtx.drawImage(srcCanvas, 0, 0, sw, sh);
    destCtx.imageSmoothingEnabled = false;
    destCtx.clearRect(0, 0, w, h);
    destCtx.drawImage(tmp, 0, 0, sw, sh, 0, 0, w, h);
    destCtx.imageSmoothingEnabled = true;
  }

  function render() {
    t += 16;
    drawScene(offCtx, W, H, t, hue);

    if (mode === "pixelate") {
      pixelate(off, ctx, W, H, intensity);
    } else if (mode === "blur") {
      ctx.clearRect(0, 0, W, H);
      ctx.filter = `blur(${intensity}px)`;
      ctx.drawImage(off, 0, 0);
      ctx.filter = "none";
    } else {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0);
    }
  }

  function loop() {
    render();
    rafId = requestAnimationFrame(loop);
  }

  return { init, stop, setMode, setIntensity };
})();
