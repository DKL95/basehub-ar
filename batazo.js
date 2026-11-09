// Minijuego "Batazo": el jugador batea los lanzamientos del pitcher rival.
// Vista desde atrás del catcher dibujada en un <canvas> con perspectiva
// simple. Se toca la pantalla (o la barra espaciadora) para hacer swing; el
// resultado depende de qué tan cerca del momento ideal (cuando la bola cruza
// el home) se haya tocado. Se juega una entrada: 3 outs y se acaba.

const Batazo = (() => {
  const RECORD_KEY = "basehub-batazo-record";
  // Mejor partida de cada equipo: { [teamId]: { best, games, hits, hrs } }.
  const SCORES_KEY = "basehub-batazo-equipos";
  // Trofeo 3D de cada equipo (Galería → Insignias): carreras en una partida.
  const TROPHY_TIERS = [
    { id: "oro", label: "Oro", min: 12 },
    { id: "plata", label: "Plata", min: 8 },
    { id: "bronce", label: "Bronce", min: 5 },
  ];
  const UNLOCK = 5;
  const W = 360, H = 480;               // tamaño lógico del canvas
  const HOME_Y = 440, HORIZON = 60, FOCAL = 90, K = 3.4;

  // Lanzamientos: T = ms que tarda la bola del pitcher al home.
  const PITCHES = [
    { name: "Recta", T: 640, curve: 0, drop: 0, weight: 4 },
    { name: "Slider", T: 720, curve: 26, drop: 6, weight: 2 },
    { name: "Curva", T: 820, curve: -30, drop: 22, weight: 2 },
    { name: "Cambio", T: 940, curve: 6, drop: 12, weight: 2 },
  ];

  // Zona de strike en pantalla (más grande que la real para que sea jugable).
  const ZONE = { x: 152, y: 362, w: 56, h: 62 };

  // Ventanas de tiempo (ms de diferencia con el momento ideal). Calibradas con
  // una simulación: un jugador con ±60 ms de error hace 5+ carreras en ~50% de
  // las partidas, 8+ en ~23% y 12+ en ~6% (metas de los trofeos).
  const WIN = { hr: 22, extra: 45, single: 80, foul: 125 };

  // Posiciones de los fildeadores (pies, home en el origen).
  const FIELDERS = [
    { x: 70, y: 92 }, { x: 34, y: 140 }, { x: -34, y: 140 }, { x: -70, y: 92 },
    { x: -150, y: 255 }, { x: 0, y: 290 }, { x: 150, y: 255 },
  ];
  const BASES = [{ x: 63.6, y: 63.6 }, { x: 0, y: 127 }, { x: -63.6, y: 63.6 }];

  const root = document.getElementById("batazoBody");
  let canvas = null, ctx = null, raf = 0, running = false;
  let teamId = null;
  let g = null;   // partida en curso

  const logoCache = {};
  function logoImg(team) {
    if (!logoCache[team.id]) { const im = new Image(); im.src = team.logo; logoCache[team.id] = im; }
    return logoCache[team.id];
  }

  function loadRecord() {
    try { return JSON.parse(localStorage.getItem(RECORD_KEY)) || null; } catch { return null; }
  }
  function saveRecord(rec) {
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(rec)); } catch { /* sin almacenamiento */ }
  }
  function loadScores() {
    try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || {}; } catch { return {}; }
  }
  // Guarda la partida y devuelve el mejor puntaje anterior y el nuevo.
  function saveTeamScore(id, runs, hits, hrs) {
    const all = loadScores();
    const prev = all[id] || { best: 0, games: 0, hits: 0, hrs: 0 };
    all[id] = { best: Math.max(prev.best, runs), games: prev.games + 1, hits: prev.hits + hits, hrs: prev.hrs + hrs };
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(all)); } catch { /* sin almacenamiento */ }
    return { before: prev.best, after: all[id].best };
  }
  // Nivel del trofeo según el mejor puntaje ("oro" | "plata" | "bronce" | "bloqueada").
  function tierOf(best) {
    const t = TROPHY_TIERS.find(x => (best || 0) >= x.min);
    return t || { id: "bloqueada", label: "Bloqueado", min: UNLOCK };
  }
  // Texto de lo que falta para el siguiente nivel.
  function nextGoal(best) {
    const next = TROPHY_TIERS.slice().reverse().find(x => (best || 0) < x.min);
    return next ? `${next.min} carreras para ${next.id === "bronce" ? "desbloquear el trofeo" : next.label}` : "¡Trofeo de oro! Nivel máximo";
  }

  const sound = (n) => { if (typeof StadiumSounds !== "undefined") StadiumSounds.play(n); };

  // Proyección de un punto del campo (pies) a la pantalla.
  function project(fx, fy, h) {
    const s = FOCAL / (FOCAL + Math.max(-40, fy));
    return { x: W / 2 + fx * s * K, y: HORIZON + (HOME_Y - HORIZON) * s - (h || 0) * s * K, s };
  }

  /* ---------------- MENÚ ---------------- */
  function renderMenu() {
    stopLoop();
    g = null;
    const rec = loadRecord();
    const scores = loadScores();
    if (!teamId) teamId = rec?.team || TEAMS[0].id;
    root.innerHTML = `
      <div class="pad" style="padding-bottom:0;">
        <h1 class="page-title">Batazo ⚾</h1>
        <p class="lead">Toca la pantalla justo cuando la bola llegue al home. Entre mejor sea tu tiempo, más lejos se va: sencillo, doble, triple… ¡o jonrón! Tienes una entrada: con 3 outs se acaba.</p>
      </div>
      <div class="bz-record">${rec ? `🏆 Tu récord: <b>${rec.runs} carrera${rec.runs === 1 ? "" : "s"}</b> con ${teamName(rec.team)}` : "Aún no tienes récord. ¡Ve por él!"}</div>
      <h2 class="section-title pad-h">Elige tu equipo</h2>
      <p class="bz-trophy-note pad-h">🏆 Haz <b>${UNLOCK} carreras</b> en una partida para ganar el trofeo 3D de ese equipo (plata con 8, oro con 12). Los ves en Galería → Insignias.</p>
      <div class="bz-teams">
        ${TEAMS.map(t => {
          const best = scores[t.id]?.best || 0, tier = tierOf(best);
          return `
          <button class="bz-team${t.id === teamId ? " active" : ""} tier-${tier.id}" data-bz-team="${t.id}" style="--tc:${t.color}">
            <img src="${t.logo}" alt="" /><span>${t.name}</span>
            <small>${tier.id === "bloqueada" ? `${best}/${UNLOCK}` : `🏆 ${tier.label}`}</small>
          </button>`;
        }).join("")}
      </div>
      <div class="pad" style="text-align:center;"><button class="btn" data-bz-start style="min-width:200px;">¡A batear!</button></div>
      <div class="bz-legend pad-h">
        <div><b>Jonrón</b> 4 bases · <b>Triple</b> 3 · <b>Doble</b> 2 · <b>Sencillo</b> 1</div>
        <div>Si no haces swing a una bola fuera de la zona es <b>bola</b>; 4 bolas = base por bolas. 3 strikes = ponche.</div>
      </div>`;
  }
  function teamName(id) { return (TEAMS.find(t => t.id === id) || TEAMS[0]).name; }

  /* ---------------- PARTIDA ---------------- */
  function start() {
    const team = TEAMS.find(t => t.id === teamId) || TEAMS[0];
    const others = TEAMS.filter(t => t.id !== team.id);
    const rival = others[Math.floor(Math.random() * others.length)];
    g = {
      team, rival,
      runs: 0, outs: 0, strikes: 0, balls: 0, hits: 0, hrs: 0, pitchCount: 0,
      bases: [false, false, false],
      phase: "idle", t0: 0, pitch: null, swing: null, flight: null,
      msg: null, particles: [], fielderOffset: null, over: false,
    };
    root.innerHTML = `
      <div class="bz-hud">
        <div class="bz-score">
          <div class="bz-team-score"><img src="${team.logo}" alt="" style="background:${team.color}"/><b id="bzRuns">0</b></div>
          <div class="bz-vs">vs</div>
          <div class="bz-team-score rival"><img src="${rival.logo}" alt="" style="background:${rival.color}"/><span>${rival.name}</span></div>
        </div>
        <div class="bz-count" id="bzCount"></div>
        <button class="bz-mute" id="bzMute" type="button" aria-label="Sonido"></button>
      </div>
      <div class="bz-canvas-wrap"><canvas id="bzCanvas" role="img" aria-label="Campo de juego: toca para hacer swing"></canvas></div>
      <div class="bz-hint" id="bzHint">Toca el campo para hacer swing</div>
      <div class="pad" style="text-align:center;padding-top:4px;"><button class="link-btn" data-bz-menu>← Salir al menú</button></div>`;
    canvas = document.getElementById("bzCanvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); swing(); });
    document.getElementById("bzMute").addEventListener("click", toggleMute);
    paintMute();
    updateHud();
    nextPitch(900);
    startLoop();
  }

  function toggleMute() {
    if (typeof StadiumSounds === "undefined") return;
    StadiumSounds.setMuted(!StadiumSounds.isMuted());
    paintMute();
  }
  function paintMute() {
    const b = document.getElementById("bzMute");
    if (b) b.textContent = typeof StadiumSounds !== "undefined" && StadiumSounds.isMuted() ? "🔇" : "🔊";
  }

  function updateHud() {
    if (!g) return;
    document.getElementById("bzRuns").textContent = g.runs;
    const dots = (n, max, cls) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? cls : ""}"></i>`).join("");
    const b = g.bases;
    document.getElementById("bzCount").innerHTML = `
      <div class="bz-diamond">
        <span class="b2${b[1] ? " on" : ""}"></span><span class="b3${b[2] ? " on" : ""}"></span><span class="b1${b[0] ? " on" : ""}"></span>
      </div>
      <div class="bz-bso">
        <div><em>B</em>${dots(g.balls, 3, "ball")}</div>
        <div><em>S</em>${dots(g.strikes, 2, "strike")}</div>
        <div><em>O</em>${dots(g.outs, 2, "out")}</div>
      </div>`;
  }

  function pickPitch() {
    const total = PITCHES.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total, p = PITCHES[0];
    for (const x of PITCHES) { r -= x.weight; if (r <= 0) { p = x; break; } }
    // Se pone más difícil conforme anotas.
    const mult = Math.max(0.72, 1 - g.runs * 0.03 - g.hits * 0.01);
    const T = p.T * mult * (0.95 + Math.random() * 0.1);
    const inZone = Math.random() < 0.68;
    let tx, ty;
    if (inZone) {
      tx = ZONE.x + 6 + Math.random() * (ZONE.w - 12);
      ty = ZONE.y + 6 + Math.random() * (ZONE.h - 12);
    } else {
      const side = Math.floor(Math.random() * 4);
      tx = side === 0 ? ZONE.x - 14 - Math.random() * 16 : side === 1 ? ZONE.x + ZONE.w + 14 + Math.random() * 16 : ZONE.x + Math.random() * ZONE.w;
      ty = side === 2 ? ZONE.y - 14 - Math.random() * 14 : side === 3 ? ZONE.y + ZONE.h + 12 + Math.random() * 12 : ZONE.y + Math.random() * ZONE.h;
    }
    return { ...p, T, tx, ty, inZone, kmh: Math.round(95000 / T) };
  }

  function nextPitch(delay) {
    g.phase = "wait";
    g.t0 = performance.now() + (delay || 0);
    g.swing = null; g.flight = null; g.fielderOffset = null;
    g.pitch = pickPitch();
  }

  // Posición de la bola lanzada para z (0 = mano del pitcher, 1 = home).
  const REL = { fy: 56, h: 6 };
  function pitchPos(p, z) {
    const s0 = FOCAL / (FOCAL + REL.fy);
    const fy = REL.fy * (1 - z);
    const s = FOCAL / (FOCAL + fy);
    const u = (s - s0) / (1 - s0);               // avance en pantalla (acelera al acercarse)
    const start = project(0, REL.fy, REL.h);
    const x = start.x + (p.tx - start.x) * u + p.curve * (z * z - u);
    const y = start.y + (p.ty - start.y) * u - p.drop * Math.sin(Math.PI * Math.min(z, 1)) * 0.6;
    return { x, y, r: 2 + 8.5 * u };
  }

  function swing() {
    if (!g || g.over) return;
    if (g.phase !== "pitch" && g.phase !== "windup") return;
    if (g.swing) return;
    const now = performance.now();
    g.swing = { t: now };
    if (g.phase !== "pitch") { g.swing.miss = true; return; }   // swing antes de tiempo
    const plateT = g.t0 + g.pitch.T;
    const dt = now - plateT;                       // <0 temprano, >0 tarde
    const q = Math.abs(dt) + (g.pitch.inZone ? 0 : 45);
    if (Math.abs(dt) > WIN.foul + 40 || q > WIN.foul) { g.swing.miss = true; g.swing.dt = dt; return; }
    contact(dt, q);
  }

  function contact(dt, q) {
    let kind;
    if (q <= WIN.hr) kind = "hr";
    else if (q <= WIN.extra) kind = Math.random() < 0.25 ? "triple" : Math.random() < 0.3 ? "flyout" : "double";
    else if (q <= WIN.single) kind = Math.random() < 0.5 ? (Math.random() < 0.5 ? "flyout" : "groundout") : "single";
    else kind = Math.random() < 0.4 ? "groundout" : "foul";   // contacto débil

    const dir = Math.max(-1, Math.min(1, dt / 110));
    let angle = dir * 0.7 + (Math.random() - 0.5) * 0.2;
    let dist, peak, dur;
    if (kind === "hr") { dist = 430 + Math.random() * 60; peak = 120; dur = 1700; angle = dir * 0.55; }
    else if (kind === "triple") { dist = 310; peak = 55; dur = 1500; angle = (Math.abs(angle) < 0.35 ? Math.sign(angle || 1) * 0.6 : angle); }
    else if (kind === "double") { dist = 235 + Math.random() * 50; peak = 45; dur = 1300; angle = Math.sign(angle || 1) * (0.25 + Math.random() * 0.2); }
    else if (kind === "single") { dist = 150 + Math.random() * 45; peak = 18; dur = 950; angle = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.35); }
    else if (kind === "flyout") { dist = 0; peak = 90; dur = 1600; }
    else if (kind === "groundout") { dist = 0; peak = 0; dur = 800; }
    else { dist = 140 + Math.random() * 60; peak = 70; dur = 1100; angle = Math.sign(dt || 1) * (0.95 + Math.random() * 0.2); }

    let tx = Math.sin(angle) * dist, ty = Math.cos(angle) * dist;
    if (kind === "flyout") {
      // La atrapa el jardinero más cercano a la dirección del batazo.
      const of = FIELDERS.slice(4).sort((a, b) => Math.abs(Math.atan2(a.x, a.y) - angle) - Math.abs(Math.atan2(b.x, b.y) - angle))[0];
      tx = of.x + (Math.random() - 0.5) * 40; ty = of.y - 20 + Math.random() * 30;
      g.fielderOffset = { idx: FIELDERS.indexOf(of), tx, ty };
    } else if (kind === "groundout") {
      // Rodado al jugador de cuadro más cercano (1B, 2B, SS o 3B).
      const inf = FIELDERS.slice(0, 4).sort((a, b) => Math.abs(Math.atan2(a.x, a.y) - angle) - Math.abs(Math.atan2(b.x, b.y) - angle))[0];
      tx = inf.x * 0.85; ty = inf.y * 0.85;
      g.fielderOffset = { idx: FIELDERS.indexOf(inf), tx, ty };
    }
    g.phase = "flight";
    g.flight = { kind, t: performance.now(), dur, fx: 0, fy: 2, tx, ty, peak };
    sound(kind === "hr" ? "homer" : "hit");
    const label = Math.abs(dt) < 15 ? "¡Perfecto!" : dt < 0 ? "Temprano" : "Tarde";
    setHint(`${label} (${dt > 0 ? "+" : ""}${Math.round(dt)} ms)`);
  }

  function setHint(t) { const h = document.getElementById("bzHint"); if (h) h.textContent = t; }

  function showMsg(text, color, big) {
    g.msg = { text, color: color || "#fff", t: performance.now(), big: !!big };
  }

  // Avanza a los corredores n bases (el bateador incluido). Devuelve carreras.
  function advance(n) {
    let runs = 0;
    const b = g.bases;
    for (let i = 2; i >= 0; i--) {
      if (!b[i]) continue;
      b[i] = false;
      if (i + n >= 3) runs++; else b[i + n] = true;
    }
    if (n >= 4) runs++; else b[n - 1] = true;
    return runs;
  }
  function walk() {
    const b = g.bases;
    let runs = 0;
    if (b[0]) { if (b[1]) { if (b[2]) runs++; b[2] = true; } b[1] = true; }
    b[0] = true;
    return runs;
  }

  function scoreRuns(r) {
    if (r <= 0) return;
    g.runs += r;
    setTimeout(() => sound("run"), 350);
  }

  function addOut(text) {
    g.outs++; g.strikes = 0; g.balls = 0;
    showMsg(text, "#ff6b6b", true);
    if (g.outs >= 3) endGame();
  }

  function resolveFlight() {
    const k = g.flight.kind;
    if (k === "foul") {
      if (g.strikes < 2) g.strikes++;
      showMsg("Foul", "#ffd166");
    } else if (k === "flyout" || k === "groundout") {
      sound("out");
      addOut(k === "flyout" ? "¡Out! Elevado" : "¡Out! Rodado");
    } else {
      const n = { single: 1, double: 2, triple: 3, hr: 4 }[k];
      const runs = advance(n);
      g.hits++; if (k === "hr") g.hrs++;
      g.strikes = 0; g.balls = 0;
      scoreRuns(runs);
      const names = { single: "¡Sencillo!", double: "¡Doble!", triple: "¡Triple!", hr: "¡JONRÓN!" };
      showMsg(names[k] + (runs ? `  +${runs}` : ""), k === "hr" ? "#ffd700" : "#7CFC8A", k === "hr" || runs > 0);
      if (k === "hr") fireworks();
    }
    updateHud();
    if (!g.over) nextPitch(1300);
  }

  function resolvePitch() {
    // La bola pasó el home sin contacto.
    sound("out");
    if (g.swing) {
      g.strikes++;
      if (g.strikes >= 3) addOut("¡Ponche!"); else showMsg("¡Strike! (abanicó)", "#ff9f43");
    } else if (g.pitch.inZone) {
      g.strikes++;
      if (g.strikes >= 3) addOut("¡Ponche! (cantado)"); else showMsg("¡Strike!", "#ff9f43");
    } else {
      g.balls++;
      if (g.balls >= 4) {
        g.balls = 0; g.strikes = 0;
        const r = walk();
        scoreRuns(r);
        showMsg("Base por bolas" + (r ? "  +1" : ""), "#74c0fc", r > 0);
      } else showMsg("Bola", "#74c0fc");
    }
    if (g.swing?.miss && g.swing.dt !== undefined) setHint(g.swing.dt < 0 ? `Muy temprano (${Math.round(g.swing.dt)} ms)` : `Muy tarde (+${Math.round(g.swing.dt)} ms)`);
    else if (g.swing?.miss) setHint("Espera a que el pitcher suelte la bola");
    else if (!g.swing) setHint(g.pitch.inZone ? "Esa iba en la zona: ¡hazle swing!" : "Bien visto, iba afuera de la zona");
    updateHud();
    if (!g.over) nextPitch(1100);
  }

  function endGame() {
    g.over = true;
    const rec = loadRecord();
    const isRecord = !rec || g.runs > rec.runs;
    if (isRecord) saveRecord({ runs: g.runs, team: g.team.id, hits: g.hits, hrs: g.hrs });
    const team = saveTeamScore(g.team.id, g.runs, g.hits, g.hrs);
    const game = g;
    setTimeout(() => { if (g === game) renderOver(game, isRecord, rec, team); }, 1600);
  }

  function renderOver(fg, isRecord, prev, team) {
    stopLoop();
    const oldTier = tierOf(team.before), newTier = tierOf(team.after);
    const unlocked = oldTier.id !== newTier.id;   // ganó el trofeo o subió de nivel
    if (unlocked) {
      sound("party");
      toast(`🏆 Trofeo ${newTier.label}: ${fg.team.name}`);
      setTimeout(() => document.querySelector(".bz-over") && openTrophyViewer(fg.team.id, `${oldTier.id === "bloqueada" ? "¡Nuevo trofeo!" : "¡Subiste de nivel!"} · ${newTier.label} · ${fg.runs} carreras`), 500);
    } else if (isRecord && fg.runs > 0) { toast("🏆 ¡Nuevo récord!"); sound("party"); }
    const pct = Math.min(100, (team.after / 12) * 100);
    root.innerHTML = `
      <div class="trivia-result bz-over">
        <div>¡Fin de la entrada!</div>
        <div class="score">${fg.runs}</div>
        <div>carrera${fg.runs === 1 ? "" : "s"} con ${fg.team.name}</div>
        <div class="bz-stats">
          <div><b>${fg.hits}</b>Hits</div><div><b>${fg.hrs}</b>Jonrones</div><div><b>${fg.pitchCount}</b>Lanzamientos</div>
        </div>
        <div class="bz-record">${isRecord && fg.runs > 0 ? "🏆 ¡Nuevo récord general!" : prev ? `Récord general: ${prev.runs} carrera${prev.runs === 1 ? "" : "s"}` : ""}</div>
        <button class="bz-trophy-row tier-${newTier.id}" data-bz-trophy="${fg.team.id}">
          <div class="badge-medal" data-trophy-img="${fg.team.id}"><span>${newTier.id === "bloqueada" ? "🔒" : "🏆"}</span></div>
          <div class="bz-trophy-info">
            <b>Trofeo ${fg.team.name} · ${newTier.id === "bloqueada" ? "Bloqueado" : newTier.label}</b>
            <div class="bz-trophy-bar"><div style="width:${pct}%"></div><i style="left:${5 / 12 * 100}%"></i><i style="left:${8 / 12 * 100}%"></i></div>
            <small>Mejor: ${team.after} carrera${team.after === 1 ? "" : "s"} · ${nextGoal(team.after)}</small>
          </div>
        </button>
        <div class="trivia-result-actions">
          <button class="btn" data-bz-start>Jugar de nuevo</button>
          <button class="btn ghost" data-bz-menu>Cambiar equipo</button>
          <button class="link-btn" data-bz-gallery>Ver mis trofeos en Galería →</button>
        </div>
      </div>`;
    paintTrophyImages();
    g = null;
  }

  function fireworks() {
    const cols = ["#ffd700", "#ff6b6b", "#74c0fc", "#7CFC8A", "#fff"];
    for (let k = 0; k < 3; k++) {
      const cx = 70 + Math.random() * 220, cy = 40 + Math.random() * 70, c = cols[Math.floor(Math.random() * cols.length)];
      const delay = k * 250;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2, v = 40 + Math.random() * 50;
        g.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, born: performance.now() + delay, life: 1100 });
      }
    }
  }

  /* ---------------- BUCLE ---------------- */
  function startLoop() { if (running) return; running = true; raf = requestAnimationFrame(frame); }
  function stopLoop() { running = false; cancelAnimationFrame(raf); }

  function frame(now) {
    if (!running || !g) return;
    update(now);
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  const WINDUP = 650;
  function update(now) {
    if (g.over) return;
    if (g.phase === "wait" && now >= g.t0) { g.phase = "windup"; g.t0 = now; }
    if (g.phase === "windup" && now - g.t0 >= WINDUP) {
      g.phase = "pitch"; g.t0 = now; g.pitchCount++;
    }
    if (g.phase === "pitch") {
      const z = (now - g.t0) / g.pitch.T;
      if (z >= 1.12) { g.phase = "done"; resolvePitch(); }
    }
    if (g.phase === "flight") {
      const f = g.flight;
      if (now - f.t >= f.dur) { g.phase = "done"; resolveFlight(); }
    }
  }

  function draw(now) {
    const c = ctx;
    c.clearRect(0, 0, W, H);
    drawField(c);
    drawFielders(c, now);
    drawRunners(c);
    drawPitcher(c, now);

    // Sombra + bola en vuelo después del batazo.
    if (g.phase === "flight" && g.flight) {
      const f = g.flight, t = Math.min(1, (now - f.t) / f.dur);
      const fx = f.fx + (f.tx - f.fx) * t, fy = f.fy + (f.ty - f.fy) * t;
      const h = f.kind === "groundout"
        ? 5 * Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t)   // va botando por el suelo
        : 3 + f.peak * 4 * t * (1 - t) + (f.kind === "hr" ? 60 * t * t : 0);
      const sh = project(fx, fy, 0), p = project(fx, fy, h);
      c.fillStyle = "rgba(0,0,0,.25)";
      c.beginPath(); c.ellipse(sh.x, sh.y, Math.max(1.5, 5 * sh.s), Math.max(1, 2 * sh.s), 0, 0, Math.PI * 2); c.fill();
      ball(c, p.x, p.y, Math.max(1.6, 8 * p.s));
    }

    drawZone(c);
    // Bola lanzada (se dibuja antes que el bateador si ya pasó el home).
    let pitchBall = null;
    if (g.phase === "pitch") {
      const z = (now - g.t0) / g.pitch.T;
      pitchBall = pitchPos(g.pitch, z);
    }
    if (pitchBall) ball(c, pitchBall.x, pitchBall.y, pitchBall.r);
    drawBatter(c, now);

    // Etiqueta del lanzamiento.
    if ((g.phase === "pitch" || g.phase === "windup") && g.pitch) {
      c.font = "bold 12px Segoe UI, Arial"; c.textAlign = "left";
      c.fillStyle = "rgba(0,0,0,.55)"; roundRect(c, 8, 448, 128, 24, 8); c.fill();
      c.fillStyle = "#fff"; c.fillText(`${g.pitch.name} · ${g.pitch.kmh} km/h`, 16, 464);
    }

    // Fuegos artificiales.
    g.particles = g.particles.filter(p => now - p.born < p.life);
    g.particles.forEach(p => {
      const t = (now - p.born) / 1000;
      if (t < 0) return;
      c.globalAlpha = 1 - (now - p.born) / p.life;
      c.fillStyle = p.c;
      c.fillRect(p.x + p.vx * t, p.y + p.vy * t + 30 * t * t, 2.5, 2.5);
    });
    c.globalAlpha = 1;

    // Mensaje grande.
    if (g.msg) {
      const age = now - g.msg.t, life = 1300;
      if (age > life) g.msg = null;
      else {
        const a = age < 150 ? age / 150 : 1 - Math.max(0, age - 900) / 400;
        const sc = g.msg.big ? 1 + 0.15 * Math.max(0, 1 - age / 200) : 1;
        c.save();
        c.globalAlpha = Math.max(0, a);
        c.translate(W / 2, 200); c.scale(sc, sc);
        c.font = `900 ${g.msg.big ? 34 : 26}px Segoe UI, Arial`;
        c.textAlign = "center"; c.textBaseline = "middle";
        c.lineWidth = 6; c.strokeStyle = "rgba(0,0,0,.7)"; c.strokeText(g.msg.text, 0, 0);
        c.fillStyle = g.msg.color; c.fillText(g.msg.text, 0, 0);
        c.restore();
      }
    }
  }

  function ball(c, x, y, r) {
    c.fillStyle = "#fff"; c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    if (r > 5) {
      c.strokeStyle = "#d33"; c.lineWidth = 1.2;
      c.beginPath(); c.arc(x - r * 0.9, y, r * 0.7, -0.9, 0.9); c.stroke();
      c.beginPath(); c.arc(x + r * 0.9, y, r * 0.7, Math.PI - 0.9, Math.PI + 0.9); c.stroke();
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); }

  function drawField(c) {
    // Cielo y tribuna.
    const sky = c.createLinearGradient(0, 0, 0, 140);
    sky.addColorStop(0, "#0b1d3a"); sky.addColorStop(1, "#24508a");
    c.fillStyle = sky; c.fillRect(0, 0, W, 140);
    c.fillStyle = "#2a2f3a"; c.fillRect(0, 70, W, 70);
    // Público (puntitos de colores fijos).
    for (let i = 0; i < 260; i++) {
      const x = (i * 37) % W, y = 76 + ((i * 53) % 56);
      c.fillStyle = ["#e9c46a", "#f4a261", "#e76f51", "#fff", "#8ecae6", g.team.color][i % 6];
      c.fillRect(x, y, 3, 3);
    }
    // Lámparas.
    [[30, 20], [330, 20]].forEach(([x, y]) => {
      c.fillStyle = "#ddd"; c.fillRect(x - 1, y, 2, 50);
      c.fillStyle = "#fffbe0"; c.shadowColor = "#fff6b0"; c.shadowBlur = 14; c.fillRect(x - 12, y - 6, 24, 9); c.shadowBlur = 0;
    });
    // Pasto.
    const wall = project(0, 340);
    const grass = c.createLinearGradient(0, wall.y, 0, H);
    grass.addColorStop(0, "#2f7d32"); grass.addColorStop(1, "#3fa443");
    c.fillStyle = grass; c.fillRect(0, wall.y - 4, W, H);
    // Franjas de podado.
    c.fillStyle = "rgba(255,255,255,.05)";
    for (let d = 160; d < 340; d += 40) {
      const a = project(-400, d), b = project(400, d), a2 = project(-400, d + 20), b2 = project(400, d + 20);
      poly(c, [a, b, b2, a2]); c.fill();
    }
    // Barda con los logos.
    c.fillStyle = "#123d1f"; c.fillRect(0, wall.y - 12, W, 12);
    c.fillStyle = "#f2c94c"; c.fillRect(0, wall.y - 1, W, 2);
    const tl = logoImg(g.team), rl = logoImg(g.rival);
    if (tl.complete && tl.naturalWidth) c.drawImage(tl, W / 2 - 50, wall.y - 12, 11, 11);
    if (rl.complete && rl.naturalWidth) c.drawImage(rl, W / 2 + 39, wall.y - 12, 11, 11);
    c.fillStyle = "#fff"; c.font = "bold 8px Segoe UI, Arial"; c.textAlign = "center"; c.fillText("BASE-HUB", W / 2, wall.y - 3);
    // Tierra del cuadro.
    const dirt = "#c48a55";
    c.fillStyle = dirt;
    const arc = [];
    for (let a = -0.85; a <= 0.85; a += 0.05) arc.push(project(Math.sin(a) * 150, Math.cos(a) * 150));
    poly(c, [project(-70, 10), ...arc, project(70, 10)]); c.fill();
    // Pasto del cuadro.
    c.fillStyle = "#3a9a3e";
    poly(c, [project(0, 14), project(56, 64), project(0, 116), project(-56, 64)]); c.fill();
    // Montículo.
    const m = project(0, 60.5);
    c.fillStyle = dirt; c.beginPath(); c.ellipse(m.x, m.y, 22 * m.s, 8 * m.s, 0, 0, Math.PI * 2); c.fill();
    // Líneas de foul.
    c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 1.5;
    const h0 = project(0, 0);
    [-1, 1].forEach(sg => { const e = project(sg * 240, 240); c.beginPath(); c.moveTo(h0.x, h0.y); c.lineTo(e.x, e.y); c.stroke(); });
    // Bases.
    c.fillStyle = "#fff";
    BASES.forEach(b => { const p = project(b.x, b.y); c.fillRect(p.x - 4 * p.s, p.y - 2 * p.s, 8 * p.s, 4 * p.s); });
    // Home.
    c.fillStyle = "#f5f5f5";
    poly(c, [{ x: 166, y: 430 }, { x: 194, y: 430 }, { x: 194, y: 437 }, { x: 180, y: 444 }, { x: 166, y: 437 }]); c.fill();
    // Cajas de bateo.
    c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 1.5;
    c.strokeRect(112, 418, 44, 36); c.strokeRect(204, 418, 44, 36);
  }

  function person(c, x, y, s, color, opts) {
    // y = pies.
    const hgt = 46 * s;
    c.fillStyle = "#222";
    c.fillRect(x - 5 * s, y - hgt * 0.42, 3.5 * s, hgt * 0.42);
    c.fillRect(x + 1.5 * s, y - hgt * 0.42, 3.5 * s, hgt * 0.42);
    c.fillStyle = color;
    roundRect(c, x - 7 * s, y - hgt * 0.82, 14 * s, hgt * 0.44, 3 * s); c.fill();
    c.fillStyle = "#e0ac69";
    c.beginPath(); c.arc(x, y - hgt * 0.9, 5 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = color;
    c.beginPath(); c.arc(x, y - hgt * 0.93, 5.2 * s, Math.PI, 0); c.fill();
    if (opts && opts.arm !== undefined) {
      c.strokeStyle = "#e0ac69"; c.lineWidth = 3 * s; c.lineCap = "round";
      const sx = x + 6 * s, sy = y - hgt * 0.76;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(opts.arm) * 14 * s, sy + Math.sin(opts.arm) * 14 * s); c.stroke();
    }
  }

  function drawPitcher(c, now) {
    const m = project(0, 60.5);
    let arm = 0.6;
    if (g.phase === "windup") {
      const t = (now - g.t0) / WINDUP;
      arm = 0.6 - t * 4.2;   // sube el brazo por detrás
    } else if (g.phase === "pitch") {
      const t = Math.min(1, (now - g.t0) / 200);
      arm = -3.6 + t * 4.6;
    }
    person(c, m.x, m.y, m.s * 1.5, g.rival.color, { arm });
  }

  function drawFielders(c, now) {
    FIELDERS.forEach((f, i) => {
      let fx = f.x, fy = f.y;
      const fo = g.fielderOffset;
      if (fo && fo.idx === i && g.phase === "flight") {
        const t = Math.min(1, (now - g.flight.t) / (g.flight.dur * 0.85));
        fx = f.x + (fo.tx - f.x) * t; fy = f.y + (fo.ty - f.y) * t;
      }
      const p = project(fx, fy);
      person(c, p.x, p.y, p.s * 1.4, g.rival.color);
    });
  }

  function drawRunners(c) {
    g.bases.forEach((on, i) => {
      if (!on) return;
      const b = BASES[i], p = project(b.x + (i === 0 ? 6 : i === 2 ? -6 : 0), b.y + 4);
      person(c, p.x, p.y, p.s * 1.4, g.team.color);
    });
  }

  function drawZone(c) {
    const show = g.phase === "pitch" || g.phase === "windup" || g.phase === "wait";
    c.strokeStyle = show ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.2)";
    c.lineWidth = 1.5; c.setLineDash([4, 4]);
    c.strokeRect(ZONE.x, ZONE.y, ZONE.w, ZONE.h);
    c.setLineDash([]);
  }

  function drawBatter(c, now) {
    const x = 130, feet = 452;
    // Ángulo del bat: en reposo apunta hacia arriba y atrás; el swing lo barre sobre el home.
    let ang = -2.2;
    if (g.swing) {
      const t = Math.min(1, (now - g.swing.t) / 170);
      ang = -2.2 + t * 3.5;
      if (now - g.swing.t > 600) ang = 1.3;
    }
    const col = g.team.color;
    // Piernas.
    c.fillStyle = "#e8e8e8";
    c.fillRect(x - 14, feet - 40, 10, 40); c.fillRect(x + 4, feet - 40, 10, 40);
    c.fillStyle = "#111"; c.fillRect(x - 16, feet - 4, 14, 5); c.fillRect(x + 2, feet - 4, 14, 5);
    // Torso.
    c.fillStyle = col; roundRect(c, x - 16, feet - 82, 32, 44, 7); c.fill();
    c.fillStyle = "#fff"; c.font = "bold 13px Segoe UI, Arial"; c.textAlign = "center";
    c.fillText(g.team.abbr, x, feet - 56);
    // Cabeza y casco.
    c.fillStyle = "#e0ac69"; c.beginPath(); c.arc(x + 2, feet - 92, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x + 2, feet - 95, 12, Math.PI * 1.05, Math.PI * 2.05); c.fill();
    c.fillRect(x + 8, feet - 97, 10, 4);
    // Manos y bat.
    const hx = x + 14, hy = feet - 70;
    c.strokeStyle = "#e0ac69"; c.lineWidth = 6; c.lineCap = "round";
    c.beginPath(); c.moveTo(x + 6, feet - 76); c.lineTo(hx, hy); c.stroke();
    c.strokeStyle = "#c9944f"; c.lineWidth = 7;
    const len = 78;
    const ex = hx + Math.cos(ang) * len, ey = hy + Math.sin(ang) * len * 0.55;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = "#a8743a"; c.lineWidth = 9;
    c.beginPath(); c.moveTo(hx + (ex - hx) * 0.6, hy + (ey - hy) * 0.6); c.lineTo(ex, ey); c.stroke();
    c.lineCap = "butt";
  }

  /* ---------------- EVENTOS ---------------- */
  root.addEventListener("click", (e) => {
    const tb = e.target.closest("[data-bz-team]");
    if (tb) {
      teamId = tb.dataset.bzTeam;
      root.querySelectorAll("[data-bz-team]").forEach(b => b.classList.toggle("active", b === tb));
      sound("click");
      return;
    }
    const tr = e.target.closest("[data-bz-trophy]");
    if (tr) { openTrophyViewer(tr.dataset.bzTrophy); return; }
    if (e.target.closest("[data-bz-gallery]")) { goTo("galeria"); setGalleryTab("insignias"); return; }
    if (e.target.closest("[data-bz-start]")) { start(); return; }
    if (e.target.closest("[data-bz-menu]")) { renderMenu(); }
  });

  document.addEventListener("keydown", (e) => {
    if (!g || e.code !== "Space") return;
    if (document.querySelector(".screen.active")?.dataset.screen !== "batazo") return;
    e.preventDefault();
    swing();
  });

  // Pausa el dibujo si la pestaña se oculta (y reanuda desde el siguiente lanzamiento).
  document.addEventListener("visibilitychange", () => {
    if (!g) return;
    if (document.hidden) stopLoop();
    else if (!g.over) { if (g.phase === "pitch" || g.phase === "windup") nextPitch(600); startLoop(); }
  });

  return {
    TIERS: TROPHY_TIERS, UNLOCK,
    scores: loadScores, tierOf, nextGoal,
    // Abre el juego directo en una partida con ese equipo (desde el visor del trofeo).
    playWith(id) { teamId = id; goTo("batazo"); start(); },
    enter() { renderMenu(); },
    leave() { stopLoop(); g = null; },
  };
})();
