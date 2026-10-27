// Ayuda contextual: el botón "?" de la barra superior abre una explicación de
// la pantalla (y, en Galería, de la pestaña) que se está viendo.

const HELP = {
  home: {
    title: "Inicio",
    steps: [
      "Es la portada de Base-Hub: un resumen de todo lo que tiene la app.",
      "Desliza el carrusel de <b>Noticias</b> hacia los lados o toca los puntos para cambiar de noticia.",
      "Toca el logo de un <b>equipo</b> para ver su plantilla de jugadores.",
      "Los botones verdes te llevan directo al Calendario, a ¿Quiénes somos? o a la Realidad Aumentada.",
      "Usa ☰ (arriba a la izquierda) para abrir el menú con todas las secciones, o la barra de abajo para las principales.",
    ],
  },
  quienes: {
    title: "¿Quiénes somos?",
    steps: [
      "Aquí se explica qué es Base-Hub y qué puedes hacer en la app.",
      "Desliza hacia abajo para leer las preguntas frecuentes: qué es Base-Hub, por qué nació, cada cuánto se actualiza, cómo funciona la Realidad Aumentada y de dónde sale la información.",
    ],
  },
  historia: {
    title: "Historia del béisbol",
    steps: [
      "Una línea del tiempo con los momentos más importantes del béisbol en México y la Zona Norte.",
      "Desliza hacia abajo para recorrer las fechas en orden.",
    ],
  },
  equipos: {
    title: "Equipos",
    steps: [
      "La lista de los 10 equipos de la Zona Norte de la Liga Mexicana de Béisbol.",
      "Toca cualquier equipo para abrir su <b>plantilla</b> con las estadísticas de cada jugador.",
    ],
  },
  jugadores: {
    title: "Plantilla de jugadores",
    steps: [
      "Arriba están los logos de todos los equipos: toca uno para cambiar de plantilla.",
      "Cada tarjeta muestra al jugador con sus estadísticas de la <b>temporada</b> y de toda su <b>carrera</b>, su posición y su edad.",
      "Bateadores: TB turnos al bat, C carreras, H hits, BT bases totales, SO ponches, BB bases por bolas, PRO promedio.",
      "Pitchers: ERA efectividad, G ganados, HR jonrones permitidos, SHO blanqueadas, H hits, R carreras, SO ponches.",
      "Toca ↩ para regresar a Equipos.",
    ],
  },
  calendario: {
    title: "Calendario",
    steps: [
      "Muestra los resultados de los playoffs 2026, un día a la vez.",
      "Toca una <b>etapa</b> (Primer Playoff, Serie de Zona, Campeonato Zona Norte o Serie del Rey) para saltar a su primer día.",
      "Usa las flechas ‹ › para ir al día anterior o al siguiente. El equipo ganador aparece resaltado; F/11 significa que el juego se fue a 11 entradas.",
      "Más abajo está la tabla final del rol regular y las fechas clave de la temporada.",
      "Escribe tu correo y toca <b>Vuélvete miembro</b> para recibir avisos de los partidos.",
    ],
  },
  trivia: {
    title: "Trivia",
    steps: [
      "Elige una trivia de la lista: cada una tiene 5 preguntas sobre la liga.",
      "Toca la respuesta que creas correcta: se marca en verde la correcta (y en rojo la tuya si fallaste) y después pasa sola a la siguiente pregunta.",
      "Al terminar ganas una <b>insignia 3D</b>: oro con 5/5, plata con 3 o 4 aciertos y bronce con menos. Si vuelves a jugar, se guarda tu mejor puntaje.",
      "Toca la insignia para verla en 3D, o ve a Galería → Insignias para ver tu colección.",
    ],
  },
  "galeria:videos": {
    title: "Galería · Videos",
    steps: [
      "Arriba puedes cambiar entre <b>Videos</b>, <b>Insignias</b> y <b>Fotos AR</b>.",
      "Toca un video para abrirlo en el reproductor, donde puedes aplicarle filtros de procesamiento de imagen en vivo.",
    ],
  },
  "galeria:insignias": {
    title: "Galería · Insignias",
    steps: [
      "Tu colección de insignias ganadas en las trivias; la barra verde muestra cuántas llevas.",
      "Las insignias con 🔒 todavía no las ganas: tócalas y usa <b>Jugar trivia</b> para ir por ella.",
      "Toca una insignia ganada para verla en 3D; arrástrala para girarla.",
    ],
  },
  "galeria:fotos": {
    title: "Galería · Fotos AR",
    steps: [
      "Aquí se guardan automáticamente las fotos que tomas con el botón <b>📸 Foto</b> dentro de la Realidad Aumentada.",
      "Las fotos se quedan guardadas en este teléfono aunque cierres la app.",
      "Toca una foto para verla en grande. Desde ahí puedes <b>⬇ Descargarla</b> a tu teléfono o <b>🗑 Borrarla</b> (toca Borrar dos veces para confirmar).",
    ],
  },
  player: {
    title: "Reproductor con filtros",
    steps: [
      "Elige un filtro de la fila de botones (desliza para ver todos) y ajústalo con las barras que aparecen debajo.",
      "Mantén presionado <b>👁 Original</b> (o el video) para comparar con la imagen sin filtro.",
      "Con ❚❚ / ▶ pausas o reproduces el video.",
      "En videos de YouTube algunos filtros aparecen con 🔒 porque YouTube no deja leer sus píxeles: usa <b>Usar mi propio video</b> para probarlos todos.",
      "Toca ↩ para volver a la Galería.",
    ],
  },
  "ar-select": {
    title: "Realidad Aumentada",
    steps: [
      "La experiencia AR reconoce el <b>logo</b> de cada equipo y muestra encima su modelo 3D.",
      "Toca un logo de la cuadrícula para ampliarlo: imprímelo o ábrelo en otra pantalla para poder escanearlo.",
      "Toca <b>Escanea Ahora</b> y permite el acceso a la cámara cuando el navegador lo pida.",
    ],
  },
  "ar-live": {
    title: "Escáner AR",
    steps: [
      "Apunta la cámara a un logo de equipo y mantenlo dentro del recuadro hasta que aparezca el modelo 3D.",
      "Usa los botones sobre el modelo: 🏟️ Diorama, ℹ️ Info, 💃 Animar, 🎉 Celebrar, 🎬 Video, 📊 En vivo y 🔊 Sonido.",
      "<b>📸 Foto</b> captura lo que ves (cámara + modelo 3D) y la guarda en Galería → Fotos AR.",
      "<b>Escanear otro</b> busca un logo nuevo; <b>Ver plantilla</b> abre los jugadores del equipo detectado.",
      "¿Sin cámara? Usa <b>Subir foto</b> (abajo) con una imagen del logo.",
    ],
  },
};

const Help = (() => {
  const sheet = document.getElementById("helpSheet");

  function currentKey() {
    const screen = document.querySelector(".screen.active")?.dataset.screen || "home";
    if (screen !== "galeria") return screen;
    const tab = document.querySelector("#galleryTabs button.active")?.dataset.galleryTab || "videos";
    return `galeria:${tab}`;
  }

  function open() {
    const h = HELP[currentKey()] || HELP.home;
    document.getElementById("helpTitle").textContent = `¿Cómo funciona? · ${h.title}`;
    document.getElementById("helpBody").innerHTML = `<ol>${h.steps.map(s => `<li>${s}</li>`).join("")}</ol>`;
    sheet.hidden = false;
  }
  function close() { sheet.hidden = true; }

  document.getElementById("helpBtn").addEventListener("click", open);
  document.getElementById("helpClose").addEventListener("click", close);
  document.getElementById("helpOk").addEventListener("click", close);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });

  return { open, close };
})();
