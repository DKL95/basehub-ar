// Navegación y renderizado de pantallas de Base-Hub (prototipo tamaño teléfono).

const screensEl = document.getElementById("screens");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const toastEl = document.getElementById("toast");

let state = {
  currentTeam: null,   // equipo elegido para roster / AR
  dayIndex: 0,          // día de calendario
  triviaIndex: 0,
  triviaScore: 0,
  triviaAnswered: false,
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

  if (screen === "jugadores") renderRoster();
  if (screen === "calendario") renderCalendario();
  if (screen === "trivia") renderTrivia(true);
  if (screen === "ar-select") Ar.renderTargetGrid();
  if (screen === "ar-live") Ar.enterLive();
  if (screen !== "player") VideoFilters.stop();
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
function renderCalendario() {
  const d = SCHEDULE[state.dayIndex];
  document.getElementById("dayIndicator").textContent = `${state.dayIndex + 1} / ${SCHEDULE.length}`;
  document.getElementById("scheduleDay").innerHTML = `
    <div class="day-block">
      <h4>${d.day}</h4>
      <table class="games">
        ${d.games.map(g => `<tr><td><b>${g.a}</b></td><td>VS</td><td>${g.b}</td><td class="time">${g.time}</td></tr>`).join("")}
      </table>
    </div>`;
  document.getElementById("footerCalendario").innerHTML = footerHTML();
}
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
  toast(val ? "¡Listo! Te avisaremos de cada partido." : "Escribe tu correo primero.");
});

/* ---------------- TRIVIA ---------------- */
function renderTrivia(reset) {
  if (reset) { state.triviaIndex = 0; state.triviaScore = 0; state.triviaAnswered = false; }
  const body = document.getElementById("triviaBody");

  if (state.triviaIndex >= TRIVIA.length) {
    body.innerHTML = `
      <div class="trivia-result">
        <div>¡Trivia completada!</div>
        <div class="score">${state.triviaScore} / ${TRIVIA.length}</div>
        <button class="btn" id="retryTrivia">Volver a intentar</button>
      </div>`;
    document.getElementById("retryTrivia").addEventListener("click", () => renderTrivia(true));
    return;
  }

  const q = TRIVIA[state.triviaIndex];
  state.triviaAnswered = false;
  body.innerHTML = `
    <div class="trivia-wrap">
      <div class="trivia-progress">Pregunta ${state.triviaIndex + 1} de ${TRIVIA.length} &nbsp;·&nbsp; Aciertos: ${state.triviaScore}</div>
      <div class="trivia-q-wrap">
        <div class="trivia-banner">${q.q}</div>
        <span class="trivia-tag">Pregunta No${state.triviaIndex + 1}</span>
      </div>
      <div class="trivia-options">
        ${q.options.map((o, i) => `<button data-i="${i}">${o}</button>`).join("")}
      </div>
    </div>`;
  body.querySelectorAll(".trivia-options button").forEach(btn => {
    btn.addEventListener("click", () => {
      if (state.triviaAnswered) return;
      state.triviaAnswered = true;
      const i = Number(btn.dataset.i);
      const correct = q.correct;
      body.querySelectorAll(".trivia-options button").forEach((b2, i2) => {
        b2.disabled = true;
        if (i2 === correct) b2.classList.add("correct");
        else if (i2 === i) b2.classList.add("wrong");
      });
      if (i === correct) { state.triviaScore++; toast("¡Correcto! ⚾"); }
      else toast("Casi... ¡sigue intentando!");
      setTimeout(() => { state.triviaIndex++; renderTrivia(false); }, 1100);
    });
  });
  document.getElementById("footerTrivia").innerHTML = "";
}

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
    <div class="video-thumb" style="${bg}" data-yt="${v.youtube}">
      <span class="yt-badge">YouTube</span>
      <div class="play"><span>▶</span></div>
      <button class="filter-fab" data-open-video="${cat}:${idx}" title="Probar filtros de imagen">🎛️</button>
    </div>
    <div class="video-title">${v.title}</div>
    <div class="video-sub">Ver en YouTube · toca 🎛️ para filtros</div>`;
}
function renderGaleria() {
  document.getElementById("videoGridInfo").innerHTML = VIDEOS.informativos.map((v, i) => `<div>${videoCardHTML(v, "informativos", i)}</div>`).join("");
  document.getElementById("videoGridLiga").innerHTML = VIDEOS.liga.map((v, i) => `<div>${videoCardHTML(v, "liga", i)}</div>`).join("");
  document.getElementById("footerGaleria").innerHTML = footerHTML();
}
screensEl.addEventListener("click", (e) => {
  const fab = e.target.closest("[data-open-video]");
  if (fab) {
    e.stopPropagation();
    const [cat, idx] = fab.dataset.openVideo.split(":");
    openPlayer(VIDEOS[cat][Number(idx)]);
    return;
  }
  const thumb = e.target.closest("[data-yt]");
  if (thumb) {
    window.open(thumb.dataset.yt, "_blank", "noopener");
  }
});

let ownVideoUrl = null;
let currentFilter = FILTERS[0];

function openPlayer(video, src) {
  document.getElementById("playerTitle").textContent = video.title;
  const yt = document.getElementById("playerYtLink");
  yt.hidden = !video.youtube;
  if (video.youtube) yt.href = video.youtube;
  goTo("player");
  const source = src || video.src || null;
  document.getElementById("playerNote").textContent = source
    ? "Elige un filtro y ajústalo en vivo. Mantén presionado el video para comparar con el original."
    : "Este video aún no tiene archivo local: se muestra una escena de demostración. Usa “Usar mi propio video” para filtrar un clip real.";
  VideoFilters.init(document.getElementById("videoCanvas"), video.hue, source);
  document.getElementById("playToggle").hidden = !source;
  document.getElementById("playToggle").textContent = "❚❚";
  selectFilter("none");
}

function renderFilterButtons() {
  document.getElementById("filterControls").innerHTML = FILTERS.map(f =>
    `<button class="btn ghost" data-filter="${f.id}">${f.label}</button>`).join("");
}

function selectFilter(id) {
  const f = currentFilter = FILTERS.find(x => x.id === id);
  VideoFilters.setMode(id);
  document.querySelectorAll("#filterControls .btn").forEach(b => b.classList.toggle("active", b.dataset.filter === id));
  document.querySelector(`#filterControls [data-filter="${id}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  document.getElementById("filterBadge").textContent = f.label;
  document.getElementById("filterSliders").innerHTML = f.controls.map(c => `
    <div class="slider-row">
      <label>${c.label} <b data-val="${c.key}">${c.value}${c.unit || ""}</b></label>
      <input type="range" data-param="${c.key}" min="${c.min}" max="${c.max}" value="${c.value}" />
    </div>`).join("");
}

renderFilterButtons();
document.getElementById("filterControls").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  selectFilter(btn.dataset.filter);
  toast(`Filtro: ${btn.textContent}`);
});
document.getElementById("filterSliders").addEventListener("input", (e) => {
  const key = e.target.dataset.param;
  if (!key) return;
  const c = currentFilter.controls.find(x => x.key === key);
  VideoFilters.setParam(key, Number(e.target.value));
  document.querySelector(`#filterSliders [data-val="${key}"]`).textContent = e.target.value + (c.unit || "");
});

// Mantener presionado el video muestra el cuadro original (comparación antes/después).
const canvasWrap = document.getElementById("canvasWrap");
const holdOriginal = (on) => (e) => {
  if (e.target.closest("#playToggle")) return;
  VideoFilters.setShowOriginal(on);
  canvasWrap.classList.toggle("showing-original", on);
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
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
