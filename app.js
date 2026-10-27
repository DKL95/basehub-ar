// Navegación y renderizado de pantallas de Base-Hub (prototipo tamaño teléfono).

const screensEl = document.getElementById("screens");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const toastEl = document.getElementById("toast");

let state = {
  currentTeam: null,   // equipo elegido para roster / AR
  dayIndex: 0,          // día de calendario
  trivia: null,         // partida de trivia en curso (null = lista de trivias)
  newsIndex: 0,          // noticia activa en el carrusel de Inicio
};

function teamLogo(team, size, extraStyle) {
  size = size || 46;
  return `<div class="team-logo" data-team="${team.id}" style="width:${size}px;height:${size}px;background:${team.color};${extraStyle || ""}"><img src="${team.logo}" alt="${team.name}" /></div>`;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function footerHTML() {
  return `
  <footer class="site-footer">
    <div class="brand">Basehub</div>
    <div class="socials">
      <span>f</span><span>in</span><span>▶</span><span>◎</span>
    </div>
  </footer>`;
}

/* ---------------- NAV ---------------- */
function goTo(screen) {
  const prevScreen = document.querySelector(".screen.active")?.dataset.screen;
  if (prevScreen === "ar-live" && screen !== "ar-live") Ar.leaveLive();

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.querySelector(`.screen[data-screen="${screen}"]`);
  if (target) target.classList.add("active");
  screensEl.scrollTop = 0;

  document.querySelectorAll(".drawer nav a").forEach(a => a.classList.toggle("active", a.dataset.nav === screen));
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.nav === screen));

  closeDrawer();
  Help.close();
  closePhotoViewer();
  if (typeof Badges3D !== "undefined" && Badges3D) Badges3D.close();

  if (screen === "jugadores") renderRoster();
  if (screen === "calendario") renderCalendario();
  if (screen === "trivia") renderTriviaList();
  if (screen === "galeria") { renderBadges(); renderPhotos(); }
  if (screen === "ar-select") Ar.renderTargetGrid();
  if (screen === "ar-live") Ar.enterLive();
  if (screen !== "player") { VideoFilters.stop(); closeEmbed(); }
}

function openDrawer() { drawer.classList.add("open"); drawerBackdrop.classList.add("open"); }
function closeDrawer() { drawer.classList.remove("open"); drawerBackdrop.classList.remove("open"); }

document.getElementById("menuBtn").addEventListener("click", openDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

document.body.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if (navEl) { goTo(navEl.dataset.nav); return; }

  const teamEl = e.target.closest("[data-team]");
  if (teamEl && !e.target.closest("#rosterPick")) {
    state.currentTeam = teamEl.dataset.team;
    const screen = document.querySelector(".screen.active").dataset.screen;
    if (screen === "home" || screen === "equipos") {
      goTo("jugadores");
    }
  }
});

/* ---------------- HOME ---------------- */
function renderHome() {
  const portada = NEWS[0];
  const featureEl = document.getElementById("featurePortada");
  featureEl.style.backgroundImage = `url('${portada.img}')`;
  featureEl.innerHTML = `<div class="cap">${portada.title}. ${portada.body}</div>`;

  renderNewsCarousel();

  document.getElementById("teamGridHome").innerHTML = TEAMS.map(t => teamLogo(t, 52)).join("");

  document.getElementById("testimonials").innerHTML = TESTIMONIALS.map(x => `
    <div class="testimonial-card">
      “${x.text}”
      <div class="who"><div class="avatar-sm"></div><div><b style="font-size:11.5px;">${x.name}</b></div></div>
    </div>`).join("");

  document.getElementById("footerHome").innerHTML = footerHTML();
}

function newsCarouselItems() {
  return NEWS.slice(1); // la primera noticia ya se usa como portada
}

function renderNewsCarousel() {
  const items = newsCarouselItems();
  if (state.newsIndex >= items.length) state.newsIndex = 0;
  const n = items[state.newsIndex];

  document.getElementById("newsCarousel").innerHTML = `
    <button class="nc-arrow left" id="newsPrev">‹</button>
    <div class="nc-img" style="background-image:url('${n.img}')"></div>
    <button class="nc-arrow right" id="newsNext">›</button>
    <h4 class="nc-title">${n.title}</h4>
    <p class="nc-body">${n.body}</p>`;

  document.getElementById("newsDots").innerHTML = items.map((_, i) =>
    `<span class="${i === state.newsIndex ? "active" : ""}"></span>`).join("");

  document.getElementById("newsPrev").addEventListener("click", () => {
    state.newsIndex = (state.newsIndex - 1 + items.length) % items.length;
    renderNewsCarousel();
  });
  document.getElementById("newsNext").addEventListener("click", () => {
    state.newsIndex = (state.newsIndex + 1) % items.length;
    renderNewsCarousel();
  });

  const track = document.getElementById("newsCarousel");
  let touchStartX = null;
  track.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      state.newsIndex = (state.newsIndex + (dx < 0 ? 1 : -1) + items.length) % items.length;
      renderNewsCarousel();
    }
    touchStartX = null;
  });
}

/* ---------------- HISTORIA ---------------- */
function renderHistoria() {
  document.getElementById("timeline").innerHTML = HISTORY.map(h => `
    <div class="tl-item">
      <div class="dot" style="border-color:${h.color}"></div>
      <div class="year" style="color:${h.color}">${h.year}</div>
      <div class="tl-card" style="border-left-color:${h.color}">${h.text}</div>
    </div>`).join("");
  document.getElementById("footerHistoria").innerHTML = footerHTML();
}

/* ---------------- QUIENES SOMOS ---------------- */
const FAQ = [
  { q: "¿Qué es Basehub?", a: "Basehub es un sitio web dedicado a la reunión de información acerca de la liga mexicana de beisbol (Zona Norte), mostrada de forma interactiva y dinámica por medio de modelos estadísticos, trivias y realidad aumentada." },
  { q: "¿Por qué nació Basehub?", a: "Basehub nació como una herramienta por y para todos los fans del beisbol mexicano. Queremos brindar la mejor experiencia para los fans, haciendo un sitio accesible, dinámico y divertido." },
  { q: "¿Cada cuánto se actualiza la información?", a: "La información se actualiza generalmente todos los días en la madrugada, con excepción de partidos importantes como las finales o los clásicos, que se actualizan en tiempo real." },
  { q: "¿Cómo funciona la Realidad Aumentada?", a: "Funciona por medio del escáner (usualmente del celular). Al escanear el logo del equipo, se desplegará un jugador del equipo correspondiente con efectos visuales especiales." },
  { q: "¿De dónde sacamos nuestra información?", a: "Nuestra información es altamente confiable y de fuentes verídicas. Obtenemos las noticias directamente de la página oficial de la liga mexicana de beisbol, y tenemos empleados dedicados a recopilar estadísticas de cada partido." },
];
function renderQuienes() {
  document.getElementById("faqList").innerHTML = FAQ.map(f => `
    <div class="faq-item"><h4>${f.q}</h4><p>${f.a}</p></div>`).join("");
  document.getElementById("footerQuienes").innerHTML = footerHTML();
}

/* ---------------- EQUIPOS ---------------- */
function renderEquipos() {
  document.getElementById("teamList").innerHTML = TEAMS.map(t => `
    <div class="team-row">
      <div class="logo-lg" data-team="${t.id}" style="background:${t.color};"><img src="${t.logo}" alt="${t.name}" /></div>
      <div class="info">
        <div class="team-badge">${t.name}</div>
        <div class="team-stats-grid">
          <div><div class="cell-label">Ciudad/Estado</div><div class="cell-val">${t.city}</div></div>
          <div><div class="cell-label">Estadio</div><div class="cell-val">${t.stadium}</div></div>
          <div><div class="cell-label">Apodo</div><div class="cell-val">“${t.nickname}”</div></div>
          <div><div class="cell-label">Capacidad</div><div class="cell-val">${t.capacity}</div></div>
        </div>
        <button class="btn see-players" data-team="${t.id}">Ver jugadores</button>
      </div>
    </div>`).join("");
  document.getElementById("footerEquipos").innerHTML = footerHTML();
}

/* ---------------- JUGADORES / ROSTER ---------------- */
function renderRoster() {
  if (!state.currentTeam) state.currentTeam = TEAMS[0].id;
  document.getElementById("rosterPick").innerHTML = TEAMS.map(t =>
    `<div class="team-logo${t.id === state.currentTeam ? " sel" : ""}" data-roster-team="${t.id}" style="background:${t.color};"><img src="${t.logo}" alt="${t.name}" /></div>`
  ).join("");

  document.querySelectorAll("#rosterPick [data-roster-team]").forEach(el => {
    el.addEventListener("click", () => { state.currentTeam = el.dataset.rosterTeam; renderRoster(); });
  });

  const team = TEAMS.find(t => t.id === state.currentTeam);
  const players = PLAYERS[state.currentTeam] || [];
  document.getElementById("rosterList").innerHTML = players.map(p => {
    const initials = p.name.split(" ").map(w => w[0]).slice(0, 2).join("");
    const statsHTML = p.type === "bat"
      ? statTable(["TB","C","H","BT","SO","BB","PRO"], p.season) + statTable(["JT","TB","C","H","BT","SO","BB","PRO"], p.career)
      : statTable(["ERA","G","HR","SHO","H","R","SO"], p.season) + statTable(["ERA","G","HR","SHO","H","R","SO"], p.career);
    return `
    <div class="player-card">
      <div>
        <div class="player-photo" style="background:${team.color};">${initials}</div>
        <div class="player-name-tag">${p.name.split(" ")[0]}</div>
      </div>
      <div class="player-info">
        <h4>${p.name}</h4>
        <div style="font-size:10.5px;color:#888;margin-bottom:4px;">Estadísticas (Temporada)</div>
        ${statTable(Object.keys(p.season), p.season)}
        <div style="font-size:10.5px;color:#888;margin:5px 0 4px;">Estadísticas (Total Carrera)</div>
        ${statTable(Object.keys(p.career), p.career)}
        <div class="meta-box">Posición: ${p.pos} &nbsp;·&nbsp; Edad: ${p.age} años</div>
      </div>
    </div>`;
  }).join("");
  document.getElementById("footerJugadores").innerHTML = footerHTML();
}
function statTable(cols, data) {
  return `<table class="stat-table"><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr><tr>${cols.map(c => `<td>${data[c]}</td>`).join("")}</tr></table>`;
}

/* ---------------- CALENDARIO ---------------- */
// "2026-08-08" -> "Sábado, 8 de agosto"
function formatDay(iso) {
  const s = new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function scheduleTeam(name, won) {
  const t = TEAMS.find(x => x.name === name);
  const logo = t ? `<img class="game-logo" src="${t.logo}" alt="" />` : "";
  return `<span class="game-team${won ? " won" : ""}">${logo}${name}</span>`;
}

function renderCalendario() {
  const d = SCHEDULE[state.dayIndex];
  const stages = [...new Set(SCHEDULE.map(x => x.stage))];
  document.getElementById("stageChips").innerHTML = stages.map(s =>
    `<button class="stage-chip${s === d.stage ? " active" : ""}" data-stage="${s}">${s}</button>`).join("");
  document.getElementById("dayIndicator").textContent = `${state.dayIndex + 1} / ${SCHEDULE.length}`;
  document.getElementById("scheduleDay").innerHTML = `
    <div class="day-block">
      <span class="stage-tag">${d.stage}</span>
      <h4>${formatDay(d.date)}</h4>
      <table class="games">
        <tr><th>Visitante</th><th>Marcador</th><th>Local</th></tr>
        ${d.games.map(g => `<tr>
          <td>${scheduleTeam(g.a, g.ra > g.rb)}</td>
          <td class="score">${g.ra} – ${g.rb}${g.extra ? `<small>F/${g.extra}</small>` : ""}</td>
          <td>${scheduleTeam(g.b, g.rb > g.ra)}</td></tr>`).join("")}
      </table>
    </div>`;

  const [, lw, ll] = SEASON.standings[0];
  document.getElementById("seasonInfo").innerHTML = `
    <div class="day-block">
      <h4>Tabla final · Rol regular</h4>
      <table class="games standings">
        <tr><th>#</th><th>Equipo</th><th>G</th><th>P</th><th>PCT</th><th>JV</th></tr>
        ${SEASON.standings.map(([name, w, l], i) => `<tr${i < 6 ? ' class="qualified"' : ""}>
          <td>${i + 1}</td><td>${scheduleTeam(name)}</td><td>${w}</td><td>${l}</td>
          <td>${(w / (w + l)).toFixed(3).replace(/^0/, "")}</td>
          <td>${i ? (((lw - w) + (l - ll)) / 2).toFixed(1) : "–"}</td></tr>`).join("")}
      </table>
      <p class="standings-note">Sombreados: los seis equipos que avanzaron al Primer Playoff.</p>
      <h4>Fechas clave de la temporada</h4>
      <ul class="milestones">
        ${SEASON.milestones.map(m => `<li><b>${m.date}</b>${m.text}</li>`).join("")}
      </ul>
    </div>`;
  document.getElementById("footerCalendario").innerHTML = footerHTML();
}
document.getElementById("stageChips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-stage]");
  if (!chip) return;
  state.dayIndex = SCHEDULE.findIndex(x => x.stage === chip.dataset.stage);
  renderCalendario();
});
document.getElementById("prevDay").addEventListener("click", () => {
  state.dayIndex = (state.dayIndex - 1 + SCHEDULE.length) % SCHEDULE.length;
  renderCalendario();
});
document.getElementById("nextDay").addEventListener("click", () => {
  state.dayIndex = (state.dayIndex + 1) % SCHEDULE.length;
  renderCalendario();
});
document.getElementById("newsletterBtn").addEventListener("click", () => {
  const val = document.getElementById("newsletterEmail").value.trim();
  if (!val) toast("Escribe tu correo primero.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) toast("Ese correo no parece válido.");
  else toast("¡Listo! Te avisaremos de cada partido.");
});

/* ---------------- TRIVIA ---------------- */
// 50 trivias de temas mezclados (trivias.js). Al terminar una se gana su
// insignia 3D (badges3d.js), de oro, plata o bronce según el mejor puntaje;
// se guardan en este navegador.
const BADGES_KEY = "basehub-insignias";
function loadBadges() {
  try { return JSON.parse(localStorage.getItem(BADGES_KEY)) || {}; } catch (e) { return {}; }
}
function saveBadge(id, score) {
  const badges = loadBadges();
  const isNew = !(id in badges);
  const improved = !isNew && score > badges[id];
  if (isNew || improved) badges[id] = score;
  try { localStorage.setItem(BADGES_KEY, JSON.stringify(badges)); } catch (e) { /* sin almacenamiento */ }
  return { isNew, improved };
}
function badgeTier(score, total) {
  if (score === total) return { id: "oro", label: "Oro" };
  if (score >= Math.ceil(total / 2)) return { id: "plata", label: "Plata" };
  return { id: "bronce", label: "Bronce" };
}
// Nivel de la insignia de la trivia i ("oro" | "plata" | "bronce" | "bloqueada").
function badgeTierId(i) {
  const badges = loadBadges(), t = TRIVIAS[i];
  return t.id in badges ? badgeTier(badges[t.id], t.questions.length).id : "bloqueada";
}
function badgeOpts(i) {
  const t = TRIVIAS[i];
  return { emblem: t.emblem, tier: badgeTierId(i), accentIndex: i, name: t.badge };
}

// Los modelos 3D (three.js) se cargan la primera vez que se ven insignias.
// Mientras tanto se muestra un círculo con ⚾ que luego se reemplaza.
let Badges3D = null;
let badges3dLoading = null;
function loadBadges3D() {
  if (!badges3dLoading) {
    badges3dLoading = import("./badges3d.js")
      .then(m => { Badges3D = m; paintBadgeImages(); return m; })
      .catch(err => { console.warn("No se pudieron cargar las insignias 3D", err); badges3dLoading = null; });
  }
  return badges3dLoading;
}
function badgeImgHTML(i, big) {
  return `<div class="badge-medal${big ? " big" : ""}" data-badge-img="${i}"><span>${badgeTierId(i) === "bloqueada" ? "🔒" : "⚾"}</span></div>`;
}
function paintBadgeImages() {
  if (!Badges3D) { loadBadges3D(); return; }
  document.querySelectorAll("[data-badge-img]").forEach(el => {
    const i = Number(el.dataset.badgeImg);
    const big = el.classList.contains("big");
    el.innerHTML = `<img src="${Badges3D.thumb(badgeOpts(i), big ? 320 : 192)}" alt="Insignia ${TRIVIAS[i].badge}" />`;
    el.classList.add("is-3d");
  });
}
async function openBadgeViewer(i, subtitle) {
  const m = Badges3D || await loadBadges3D();
  if (!m) return;
  const t = TRIVIAS[i], tier = badgeTierId(i);
  const best = loadBadges()[t.id];
  m.open(badgeOpts(i), {
    title: t.badge,
    subtitle: subtitle || (tier === "bloqueada"
      ? `Bloqueada · completa la ${t.title} para ganarla`
      : `${t.title} · ${tier[0].toUpperCase() + tier.slice(1)} · mejor: ${best}/${t.questions.length}`),
    actionsHTML: `<button class="btn" data-viewer-play="${i}">${tier === "bloqueada" ? "Jugar trivia" : "Jugar de nuevo"}</button>`,
  });
}
document.body.addEventListener("click", (e) => {
  const play = e.target.closest("[data-viewer-play]");
  if (!play) return;
  Badges3D?.close();
  goTo("trivia");
  startTrivia(Number(play.dataset.viewerPlay));
});
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderTriviaList() {
  state.trivia = null;
  const badges = loadBadges();
  const done = TRIVIAS.filter(t => t.id in badges).length;
  document.getElementById("triviaBody").innerHTML = `
    <div class="trivia-list-head">
      <span>Insignias ganadas: <b>${done} / ${TRIVIAS.length}</b></span>
      <button class="link-btn" data-badges-link>Ver en Galería →</button>
    </div>
    <div class="trivia-list">
      ${TRIVIAS.map((t, i) => {
        const has = t.id in badges;
        const tier = has ? badgeTier(badges[t.id], t.questions.length) : null;
        return `
        <button class="trivia-card${has ? " done tier-" + tier.id : ""}" data-trivia="${i}">
          ${badgeImgHTML(i)}
          <div class="trivia-card-title">${t.title}</div>
          <div class="trivia-card-badge">🏅 ${t.badge}</div>
          <div class="trivia-card-sub">${has ? `${tier.label} · ${badges[t.id]}/${t.questions.length}` : "Sin jugar"}</div>
        </button>`;
      }).join("")}
    </div>`;
  document.getElementById("footerTrivia").innerHTML = "";
  paintBadgeImages();
}

function startTrivia(index) {
  const t = TRIVIAS[index];
  state.trivia = {
    index, qIndex: 0, score: 0, answered: false,
    // Mezcla las opciones de cada pregunta en cada partida.
    questions: t.questions.map(q => {
      const options = shuffle([q.a, ...q.w]);
      return { q: q.q, options, correct: options.indexOf(q.a) };
    }),
  };
  renderTriviaQuestion();
  screensEl.scrollTop = 0;
}

function renderTriviaQuestion() {
  const st = state.trivia;
  const t = TRIVIAS[st.index];
  const body = document.getElementById("triviaBody");

  if (st.qIndex >= st.questions.length) { renderTriviaResult(); return; }

  const q = st.questions[st.qIndex];
  st.answered = false;
  body.innerHTML = `
    <div class="trivia-wrap">
      <button class="link-btn" data-trivia-back>← Todas las trivias</button>
      <div class="trivia-progress"><b>${t.title}</b><br>Pregunta ${st.qIndex + 1} de ${st.questions.length} &nbsp;·&nbsp; Aciertos: ${st.score}</div>
      <div class="trivia-q-wrap">
        <div class="trivia-banner">${q.q}</div>
        <span class="trivia-tag">Pregunta No${st.qIndex + 1}</span>
      </div>
      <div class="trivia-options">
        ${q.options.map((o, i) => `<button data-i="${i}">${o}</button>`).join("")}
      </div>
    </div>`;
  body.querySelectorAll(".trivia-options button").forEach(btn => {
    btn.addEventListener("click", () => {
      if (st.answered || state.trivia !== st) return;
      st.answered = true;
      const i = Number(btn.dataset.i);
      body.querySelectorAll(".trivia-options button").forEach((b2, i2) => {
        b2.disabled = true;
        if (i2 === q.correct) b2.classList.add("correct");
        else if (i2 === i) b2.classList.add("wrong");
      });
      if (i === q.correct) { st.score++; toast("¡Correcto! ⚾"); }
      else toast("Casi... ¡sigue intentando!");
      setTimeout(() => {
        if (state.trivia !== st) return; // salió de la trivia mientras tanto
        st.qIndex++;
        renderTriviaQuestion();
      }, 1100);
    });
  });
}

function renderTriviaResult() {
  const st = state.trivia;
  const t = TRIVIAS[st.index];
  const total = st.questions.length;
  const { isNew, improved } = saveBadge(t.id, st.score);
  const best = loadBadges()[t.id] ?? st.score;
  const tier = badgeTier(best, total);
  const next = st.index + 1 < TRIVIAS.length ? st.index + 1 : null;
  document.getElementById("triviaBody").innerHTML = `
    <div class="trivia-result">
      <div>¡Trivia completada!</div>
      <div class="score">${st.score} / ${total}</div>
      <button class="badge-earned tier-${tier.id}" data-badge-view="${st.index}">
        ${badgeImgHTML(st.index, true)}
        <div><b>${isNew ? "¡Nueva insignia!" : improved ? "¡Mejoraste tu insignia!" : "Insignia"}: ${t.badge}</b></div>
        <div class="badge-tier-label">${tier.label}${best > st.score ? ` · tu mejor: ${best}/${total}` : ""}</div>
        <div class="badge-tap-hint">Toca para verla en 3D</div>
      </button>
      <div class="trivia-result-actions">
        ${next !== null ? `<button class="btn" data-trivia="${next}">Siguiente trivia</button>` : ""}
        <button class="btn ghost" data-trivia="${st.index}">Volver a intentar</button>
        <button class="btn ghost" data-badges-link>Ver mis insignias</button>
        <button class="link-btn" data-trivia-back>← Todas las trivias</button>
      </div>
    </div>`;
  paintBadgeImages();
  if (isNew || improved) {
    toast(`🏅 Insignia ${tier.label}: ${t.badge}`);
    openBadgeViewer(st.index, `${isNew ? "¡Nueva insignia!" : "¡Subiste de nivel!"} · ${tier.label} · ${st.score}/${total}`);
  }
}

document.getElementById("triviaBody").addEventListener("click", (e) => {
  if (e.target.closest("[data-badges-link]")) { goTo("galeria"); setGalleryTab("insignias"); return; }
  const view = e.target.closest("[data-badge-view]");
  if (view) { openBadgeViewer(Number(view.dataset.badgeView)); return; }
  const start = e.target.closest("[data-trivia]");
  if (start) { startTrivia(Number(start.dataset.trivia)); return; }
  if (e.target.closest("[data-trivia-back]")) { renderTriviaList(); screensEl.scrollTop = 0; }
});

/* ---------------- GALERIA ---------------- */
function ytThumb(url) {
  const m = url.match(/[?&]v=([^&]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}
function videoCardHTML(v, cat, idx) {
  const thumb = ytThumb(v.youtube);
  const bg = thumb
    ? `background-color:hsl(${v.hue},55%,32%);background-image:url('${thumb}');`
    : `background:hsl(${v.hue},55%,32%);`;
  return `
    <div class="video-thumb" style="${bg}" data-open-video="${cat}:${idx}">
      <span class="yt-badge">YouTube</span>
      <div class="play"><span>▶</span></div>
    </div>
    <div class="video-title">${v.title}</div>
    <div class="video-sub">Toca para verlo con filtros 🎛️</div>`;
}
// Pestañas de Galería: videos, insignias de trivia y fotos tomadas en AR.
function setGalleryTab(tab) {
  document.querySelectorAll("#galleryTabs button").forEach(b => b.classList.toggle("active", b.dataset.galleryTab === tab));
  document.querySelectorAll("[data-gallery-panel]").forEach(p => { p.hidden = p.dataset.galleryPanel !== tab; });
}
document.getElementById("galleryTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-gallery-tab]");
  if (b) setGalleryTab(b.dataset.galleryTab);
});

function renderBadges() {
  const badges = loadBadges();
  const done = TRIVIAS.filter(t => t.id in badges).length;
  const count = (tierId) => TRIVIAS.filter(t => t.id in badges && badgeTier(badges[t.id], t.questions.length).id === tierId).length;
  document.getElementById("badgeSummary").innerHTML = `
    <div class="badge-progress"><div style="width:${(done / TRIVIAS.length) * 100}%"></div></div>
    <div class="badge-summary-row">
      <span><b>${done}</b> / ${TRIVIAS.length} insignias</span>
      <span>🥇 ${count("oro")} &nbsp; 🥈 ${count("plata")} &nbsp; 🥉 ${count("bronce")}</span>
    </div>`;
  document.getElementById("badgeGrid").innerHTML = TRIVIAS.map((t, i) => {
    const has = t.id in badges;
    const tier = has ? badgeTier(badges[t.id], t.questions.length) : null;
    return `<button class="badge-cell ${has ? "tier-" + tier.id : "locked"}" data-badge-view="${i}">
      ${badgeImgHTML(i)}
      <div class="badge-name">${t.badge}</div>
      <div class="badge-tier-label">${has ? `${tier.label} · ${badges[t.id]}/${t.questions.length}` : `Bloqueada · ${t.title}`}</div>
    </button>`;
  }).join("");
  paintBadgeImages();
}
// Tocar una insignia la abre en el visor 3D (desde ahí se puede jugar su trivia).
document.getElementById("badgeGrid").addEventListener("click", (e) => {
  const cell = e.target.closest("[data-badge-view]");
  if (cell) openBadgeViewer(Number(cell.dataset.badgeView));
});

// Fotos AR (guardadas por photos.js). Las miniaturas usan URLs de objeto que
// se liberan cada vez que se vuelve a pintar la cuadrícula.
let photoUrls = [];
let photoList = [];
let viewerPhoto = null;
function renderPhotos() {
  return ArPhotos.list().then((photos) => {
    photoUrls.forEach(u => URL.revokeObjectURL(u));
    photoList = photos;
    photoUrls = photos.map(p => URL.createObjectURL(p.blob));
    document.getElementById("photoSummary").innerHTML = photos.length
      ? `<span><b>${photos.length}</b> foto${photos.length === 1 ? "" : "s"} guardada${photos.length === 1 ? "" : "s"}</span>`
      : "";
    document.getElementById("photoGrid").innerHTML = photos.length
      ? photos.map((p, i) => `<button class="photo-cell" data-photo="${i}">
          <img src="${photoUrls[i]}" alt="Foto AR ${p.teamName}" />
          <span><b>${p.teamName}</b>${new Date(p.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span>
        </button>`).join("")
      : `<div class="photo-empty">
          <div class="emoji">📷</div>
          <b>Aún no tienes fotos</b>
          <p>Escanea el logo de un equipo y toca 📸 Foto para guardar tu primera foto aquí.</p>
          <button class="btn" data-nav="ar-select">Ir a Realidad Aumentada</button>
        </div>`;
  });
}
function photoDate(ts) {
  return new Date(ts).toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function openPhotoViewer(i) {
  viewerPhoto = photoList[i];
  document.getElementById("photoViewerImg").src = photoUrls[i];
  document.getElementById("photoViewerMeta").innerHTML = `<b>${viewerPhoto.teamName}</b><span>${photoDate(viewerPhoto.date)}</span>`;
  resetDeleteBtn();
  document.getElementById("photoViewer").hidden = false;
}
function closePhotoViewer() {
  document.getElementById("photoViewer").hidden = true;
  viewerPhoto = null;
}
// Borrar pide un segundo toque en vez de un diálogo del navegador.
function resetDeleteBtn() {
  const b = document.getElementById("photoDeleteBtn");
  b.classList.remove("confirm");
  b.textContent = "🗑 Borrar";
}
document.getElementById("photoGrid").addEventListener("click", (e) => {
  const cell = e.target.closest("[data-photo]");
  if (cell) openPhotoViewer(Number(cell.dataset.photo));
});
document.getElementById("photoCloseBtn").addEventListener("click", closePhotoViewer);
document.getElementById("photoViewer").addEventListener("click", (e) => {
  if (e.target.id === "photoViewer") closePhotoViewer();
});
document.getElementById("photoDownloadBtn").addEventListener("click", () => {
  if (viewerPhoto) ArPhotos.exportPhoto(viewerPhoto.blob, viewerPhoto.name);
});
document.getElementById("photoDeleteBtn").addEventListener("click", (e) => {
  if (!viewerPhoto) return;
  const b = e.currentTarget;
  if (!b.classList.contains("confirm")) {
    b.classList.add("confirm");
    b.textContent = "¿Borrar? Toca otra vez";
    return;
  }
  ArPhotos.remove(viewerPhoto.id).then(() => {
    closePhotoViewer();
    renderPhotos();
    toast("Foto borrada");
  });
});

function renderGaleria() {
  document.getElementById("videoGridInfo").innerHTML = VIDEOS.informativos.map((v, i) => `<div>${videoCardHTML(v, "informativos", i)}</div>`).join("");
  document.getElementById("videoGridLiga").innerHTML = VIDEOS.liga.map((v, i) => `<div>${videoCardHTML(v, "liga", i)}</div>`).join("");
  document.getElementById("footerGaleria").innerHTML = footerHTML();
}
screensEl.addEventListener("click", (e) => {
  const card = e.target.closest("[data-open-video]");
  if (!card) return;
  const [cat, idx] = card.dataset.openVideo.split(":");
  openPlayer(VIDEOS[cat][Number(idx)]);
});

let ownVideoUrl = null;
let currentFilter = FILTERS[0];
let filterParams = {};
let ytMode = false; // true: video de YouTube embebido (filtros SVG); false: canvas (filtros por píxel)

const canvasWrap = document.getElementById("canvasWrap");
const videoCanvas = document.getElementById("videoCanvas");
const ytFrame = document.getElementById("ytFrame");

function ytId(url) {
  const m = (url || "").match(/[?&]v=([^&]+)/);
  return m ? m[1] : null;
}

function openPlayer(video, src) {
  document.getElementById("playerTitle").textContent = video.title;
  const yt = document.getElementById("playerYtLink");
  yt.hidden = !video.youtube;
  if (video.youtube) yt.href = video.youtube;
  goTo("player");

  const source = src || video.src || null;
  const id = !source && ytId(video.youtube);
  ytMode = !!id;
  closeEmbed();
  const note = document.getElementById("playerNote");

  if (ytMode) {
    VideoFilters.stop();
    videoCanvas.hidden = true;
    ytFrame.hidden = false;
    canvasWrap.style.aspectRatio = "16 / 9";
    // fs=0: sin pantalla completa, porque ahí el navegador ya no aplica los filtros.
    ytFrame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0&modestbranding=1&fs=0"
      title="${video.title.replace(/"/g, "&quot;")}" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    note.textContent = "Dale ▶ al video y elige un filtro. Los filtros con 🔒 necesitan leer los píxeles y YouTube no lo permite: pruébalos con “Usar mi propio video”.";
  } else {
    videoCanvas.hidden = false;
    ytFrame.hidden = true;
    VideoFilters.init(videoCanvas, video.hue, source);
    note.textContent = source
      ? "Elige un filtro y ajústalo en vivo. Mantén presionado “Original” o el video para comparar."
      : "Este video no tiene archivo ni YouTube: se muestra una escena de demostración.";
  }
  document.getElementById("playToggle").hidden = ytMode || !source;
  document.getElementById("playToggle").textContent = "❚❚";
  renderFilterButtons();
  selectFilter("none");
}

// Quita el reproductor de YouTube (detiene el audio al salir de la pantalla).
function closeEmbed() {
  ytFrame.innerHTML = "";
  ytFrame.style.background = "";
}

function applyFilter(showOriginal) {
  if (ytMode) {
    // El filtro va en el <iframe> y el color de fondo en su contenedor, para
    // que la opacidad del pastel mezcle el video con ese fondo.
    const { filter, bg } = EmbedFilters.css(showOriginal ? "none" : currentFilter.id, filterParams);
    const iframe = ytFrame.querySelector("iframe");
    if (iframe) iframe.style.filter = filter;
    ytFrame.style.background = bg;
  } else {
    VideoFilters.setShowOriginal(!!showOriginal);
  }
  canvasWrap.classList.toggle("showing-original", !!showOriginal);
}

// En videos de YouTube los filtros que necesitan leer píxeles se muestran
// bloqueados (ver EmbedFilters en filters.js).
function filterAvailable(id) {
  return !ytMode || EmbedFilters.supports(id);
}

function renderFilterButtons() {
  document.getElementById("filterControls").innerHTML = FILTERS.map(f => filterAvailable(f.id)
    ? `<button class="btn ghost" data-filter="${f.id}">${f.label}</button>`
    : `<button class="btn ghost locked" data-filter="${f.id}" aria-disabled="true">🔒 ${f.label}</button>`).join("");
}

function selectFilter(id) {
  const f = currentFilter = FILTERS.find(x => x.id === id);
  filterParams = {};
  f.controls.forEach(c => { filterParams[c.key] = c.value; });
  VideoFilters.setMode(id);
  applyFilter(false);
  document.querySelectorAll("#filterControls .btn").forEach(b => b.classList.toggle("active", b.dataset.filter === id));
  document.querySelector(`#filterControls [data-filter="${id}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  document.getElementById("filterBadge").textContent = f.label;
  document.getElementById("filterSliders").innerHTML = f.controls.filter(c => !(ytMode && c.pixelsOnly)).map(c => `
    <div class="slider-row">
      <label>${c.label} <b data-val="${c.key}">${c.value}${c.unit || ""}</b></label>
      <input type="range" data-param="${c.key}" min="${c.min}" max="${c.max}" value="${c.value}" />
    </div>`).join("");
}

renderFilterButtons();
document.getElementById("filterControls").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  if (!filterAvailable(btn.dataset.filter)) {
    toast("YouTube no deja procesar sus píxeles: usa tu propio video");
    return;
  }
  selectFilter(btn.dataset.filter);
  toast(`Filtro: ${btn.textContent}`);
});
document.getElementById("filterSliders").addEventListener("input", (e) => {
  const key = e.target.dataset.param;
  if (!key) return;
  const c = currentFilter.controls.find(x => x.key === key);
  filterParams[key] = Number(e.target.value);
  VideoFilters.setParam(key, filterParams[key]);
  applyFilter(false);
  document.querySelector(`#filterSliders [data-val="${key}"]`).textContent = e.target.value + (c.unit || "");
});

// Comparación antes/después: mantener presionado "Original" (o el video, en
// modo canvas; el reproductor de YouTube recibe sus propios toques).
const holdOriginal = (on) => (e) => {
  if (e.target.closest("#playToggle")) return;
  if (ytMode && !e.target.closest("#compareBtn")) return;
  applyFilter(on);
};
canvasWrap.addEventListener("pointerdown", holdOriginal(true));
["pointerup", "pointerleave", "pointercancel"].forEach(ev => canvasWrap.addEventListener(ev, holdOriginal(false)));
canvasWrap.addEventListener("contextmenu", (e) => e.preventDefault());

document.getElementById("playToggle").addEventListener("click", (e) => {
  const playing = VideoFilters.togglePlay();
  if (playing === null) return;
  e.currentTarget.textContent = playing ? "❚❚" : "▶";
  e.currentTarget.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
});

document.getElementById("ownVideoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (ownVideoUrl) URL.revokeObjectURL(ownVideoUrl);
  ownVideoUrl = URL.createObjectURL(file);
  openPlayer({ title: file.name, hue: 140 }, ownVideoUrl);
  toast("Video cargado ✔");
});

/* ---------------- INIT ---------------- */
renderHome();
renderHistoria();
renderQuienes();
renderEquipos();
renderGaleria();
goTo("home");

// PWA: registra el service worker para poder "instalar" Base-Hub en el
// teléfono. Requiere contexto seguro (https o localhost); si no lo hay
// (p. ej. abierto por IP en la red local por http) simplemente no se activa
// y el resto de la app sigue funcionando igual.
if ("serviceWorker" in navigator && window.isSecureContext) {
  // Si se publica una versión nueva, el service worker nuevo toma el control
  // y se recarga una vez para no quedarse con código de la versión anterior.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
