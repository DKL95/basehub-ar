// Datos de la app Base-Hub (prototipo). Todo el contenido estadístico es
// ficticio / de ejemplo, generado para fines de la maqueta del proyecto.

const BASEHUB_LOGO = "Assets/Logo%20Basehub.png";

const TEAMS = [
  { id: "algodoneros", name: "Algodoneros", city: "Torreón, Coahuila", stadium: "Estadio la Revolución", nickname: "La Máquina Guinda", capacity: "7,600 personas", color: "#5c1f3d", abbr: "AL", logo: "Assets/algodoneros_logo.png" },
  { id: "tecos", name: "Tecos", city: "Nuevo Laredo, Tamaulipas", stadium: "Parque La Junta", nickname: "Binacionales", capacity: "8,000 personas", color: "#12213a", abbr: "TE", logo: "Assets/Tecolotes_Dos_Laredos_logo.png" },
  { id: "acereros", name: "Acereros", city: "Monclova, Coahuila", stadium: "Kickapoo Lucky Eagle", nickname: "Furia Azul", capacity: "8,500 personas", color: "#1d3f8f", abbr: "AC", logo: "Assets/Acereros_de_Monclova_logo.jpg" },
  { id: "caliente", name: "Caliente", city: "Durango, Durango", stadium: "Estadio Francisco Villa", nickname: "Caliente", capacity: "6,000 personas", color: "#1a1a1a", abbr: "CD", logo: "Assets/Caliente_de_Durango_logo.jpg" },
  { id: "charros", name: "Charros", city: "Zapopan, Jalisco", stadium: "Estadio Panamericano", nickname: "Medias Azules", capacity: "16,500 personas", color: "#1c4fa1", abbr: "CH", logo: "Assets/charros_logo.png" },
  { id: "rieleros", name: "Rieleros", city: "Aguascalientes", stadium: "Alberto Romo Chávez", nickname: "La Máquina Rielera", capacity: "6,500 personas", color: "#0e2a52", abbr: "RI", logo: "Assets/Rieleros_Logo.jpg" },
  { id: "saraperos", name: "Saraperos", city: "Saltillo, Coahuila", stadium: "Parque Francisco I. Madero", nickname: "Saraperos", capacity: "11,000 personas", color: "#0d6b5f", abbr: "SA", logo: "Assets/Saraperos_logo.png" },
  { id: "sultanes", name: "Sultanes", city: "Monterrey, N.L.", stadium: "Walmart Park", nickname: "Fantasmas Grises", capacity: "22,000 personas", color: "#12213a", abbr: "MTY", logo: "Assets/Sultanes_Logo.jpg" },
  { id: "toros", name: "Toros", city: "Tijuana, Baja California", stadium: "Toros Mobil Park", nickname: "Astados", capacity: "17,000 personas", color: "#a3161e", abbr: "TJ", logo: "Assets/Toros_tijuana_Logo.jpg" },
  { id: "dorados", name: "Dorados", city: "Chihuahua, Chihuahua", stadium: "Estadio Monumental Chihuahua", nickname: "Villistas", capacity: "14,500 personas", color: "#6a2382", abbr: "DO", logo: "Assets/Dorados_de_Chihuahua_baseball_logo.png" },
];

// Modelo 3D del AR (Assets/models): la gorra de cada equipo. La de Sultanes
// se sacó del diorama original (diorama.glb, en la carpeta del proyecto).
// modelYaw: giro inicial en grados sobre el eje vertical; en los .glb la
// visera apunta a -X, y con 90° queda de frente a la cámara.
TEAMS.forEach(t => {
  t.model = `Assets/models/${t.id}only.glb`;
  t.modelYaw = 90;
});

// Jugadores por equipo. Sultanes usa la alineación mostrada en el mockup
// original; el resto son jugadores de ejemplo (ficticios) con el mismo formato.
const PLAYERS = {
  sultanes: [
    { name: "Gustavo Núñez", pos: "SS", age: 38, type: "bat",
      season: { TB: 380, C: 61, H: 122, BT: 100, SO: 57, BB: 19, PRO: ".321" },
      career: { JT: 690, TB: 2345, C: 280, H: 901, BT: 998, SO: 443, BB: 99, PRO: ".299" } },
    { name: "Manny Bañuelos", pos: "P", age: 35, type: "pitch",
      season: { ERA: "4.25", G: 17, HR: 10, SHO: 0, H: 71, R: 40, SO: 70 },
      career: { ERA: "2.89", G: 45, HR: 17, SHO: 0, H: 154, R: 94, SO: 155 } },
    { name: "Josh Lester", pos: "1B", age: 32, type: "bat",
      season: { TB: 338, C: 46, H: 98, BT: 78, SO: 90, BB: 43, PRO: ".290" },
      career: { JT: 170, TB: 650, C: 100, H: 187, BT: 160, SO: 150, BB: 88, PRO: ".307" } },
    { name: "Victor Mendoza", pos: "1B", age: 35, type: "bat",
      season: { TB: 325, C: 42, H: 94, BT: 70, SO: 52, BB: 29, PRO: ".289" },
      career: { JT: 745, TB: 1410, C: 323, H: 488, BT: 567, SO: 512, BB: 69, PRO: ".288" } },
    { name: "Harold Ramírez", pos: "RF", age: 31, type: "bat",
      season: { TB: 186, C: 24, H: 66, BT: 134, SO: 69, BB: 8, PRO: ".333" },
      career: { JT: 536, TB: 1811, C: 221, H: 517, BT: 736, SO: 350, BB: 79, PRO: ".285" } },
  ],
};

const FILLER_NAMES = [
  ["Diego Salazar", "3B"], ["Mateo Reyes", "CF"], ["Emilio Torres", "P"],
  ["Renato Ibarra", "LF"], ["Bruno Cantú", "C"], ["Iker Delgado", "P"],
  ["Santiago Nava", "2B"], ["Adrián Cepeda", "RF"], ["Omar Villalba", "P"],
  ["Leonel Aguirre", "SS"], ["Tadeo Rosales", "1B"], ["Ximeno Cárdenas", "CF"],
];
let fillerIdx = 0;
function fillerPlayer(seed) {
  const [name, pos] = FILLER_NAMES[fillerIdx % FILLER_NAMES.length];
  fillerIdx++;
  const rnd = (min, max) => Math.floor((Math.sin(seed * 999 + fillerIdx * 37) * 0.5 + 0.5) * (max - min) + min);
  if (pos === "P") {
    return { name, pos, age: 24 + (fillerIdx % 12), type: "pitch",
      season: { ERA: (2.5 + (fillerIdx % 5) * 0.4).toFixed(2), G: 10 + (fillerIdx % 20), HR: fillerIdx % 12, SHO: fillerIdx % 3 === 0 ? 1 : 0, H: 40 + (fillerIdx % 60), R: 20 + (fillerIdx % 40), SO: 50 + (fillerIdx % 90) },
      career: { ERA: (2.2 + (fillerIdx % 4) * 0.35).toFixed(2), G: 60 + (fillerIdx % 90), HR: 20 + (fillerIdx % 30), SHO: fillerIdx % 4, H: 200 + (fillerIdx % 220), R: 90 + (fillerIdx % 150), SO: 300 + (fillerIdx % 260) } };
  }
  return { name, pos, age: 22 + (fillerIdx % 14), type: "bat",
    season: { TB: 200 + (fillerIdx % 180), C: 20 + (fillerIdx % 50), H: 60 + (fillerIdx % 80), BT: 50 + (fillerIdx % 100), SO: 30 + (fillerIdx % 70), BB: 10 + (fillerIdx % 40), PRO: "." + (240 + (fillerIdx % 90)) },
    career: { JT: 200 + (fillerIdx % 500), TB: 700 + (fillerIdx % 1500), C: 90 + (fillerIdx % 250), H: 200 + (fillerIdx % 500), BT: 250 + (fillerIdx % 600), SO: 150 + (fillerIdx % 450), BB: 40 + (fillerIdx % 100), PRO: "." + (255 + (fillerIdx % 80)) } };
}
TEAMS.forEach((t, i) => {
  if (!PLAYERS[t.id]) {
    PLAYERS[t.id] = [fillerPlayer(i), fillerPlayer(i + 1), fillerPlayer(i + 2)];
  }
});

const NEWS = [
  { title: "Dorados prende la fiesta en el Héctor Espino", body: "Pirotecnia, porristas y una afición a reventar recibieron al equipo antes del primer out...", img: "Assets/NOTICIA%20DORADOS.jpg" },
  { title: "Sultanes festejan por todo lo alto en el Walmart Park", body: "Escarrega y compañía se lanzaron a celebrar tras una jugada clave que selló el triunfo regio...", img: "Assets/Noticia%20sultanes.jpg" },
  { title: "Toros disfrutan una noche perfecta en Caliente", body: "Las sonrisas no faltaron en el dugout tijuanense tras una sólida actuación ofensiva de los Astados...", img: "Assets/Toros%20Noticia.jpg" },
];

const HISTORY = [
  { year: "Edad Media", color: "#c0392b", text: "Nace el Beisbol como una derivación del “Stool Ball”, practicado durante la Edad Media." },
  { year: "1744", color: "#c2185b", text: "La primera referencia a la palabra “Base Ball” la encontramos en este año, en Cooperstown, New York." },
  { year: "1796", color: "#2f3b8f", text: "Llegan las primeras reglas del deporte que actualmente conocemos como Baseball." },
  { year: "1845", color: "#8e24aa", text: "El club de Alexander Cartwright desarrolla 20 reglas junto con su club. Junto con reglas alemanas, se convirtió en la base del baseball moderno." },
  { year: "1865", color: "#00897b", text: "En este año ya se registraba una asistencia de 20,000 personas para un encuentro entre los NY Mutuals y el Atlantic Club de Brooklyn." },
  { year: "1866", color: "#1a3fa0", text: "El 23 de junio de 1866 se fundó el equipo Cincinnati Base Ball Club, en la ciudad de Ohio." },
];

// Temporada 2026 de la LMB, Zona Norte (datos reales). Fuente: Wikipedia,
// "Liga Mexicana de Béisbol 2026", y notas de la liga sobre el calendario.
// En cada juego `a` es el visitante y `b` el local; `ra`/`rb` sus carreras y
// `extra` las entradas cuando el juego se fue a extra innings.
const SEASON = {
  milestones: [
    { date: "16 abr", text: "Juego inaugural de la temporada: Piratas de Campeche vs Diablos Rojos del México." },
    { date: "17 abr", text: "Arranca la Zona Norte: Sultanes en Torreón ante Algodoneros, Toros ante Saraperos y Charros ante Acereros." },
    { date: "9–21 jun", text: "Bloque interzonal contra los equipos de la Zona Sur." },
    { date: "26–28 jun", text: "Juego de Estrellas en el Walmart Park de Monterrey." },
    { date: "6 ago", text: "Fin del rol regular: 93 juegos por equipo." },
    { date: "8 ago – 15 sep", text: "Playoffs. Toros de Tijuana, campeones de la Serie del Rey (su tercer título)." },
  ],
  // Tabla final del rol regular (G, P).
  standings: [
    ["Toros", 60, 31], ["Caliente", 51, 42], ["Sultanes", 49, 44], ["Acereros", 48, 45],
    ["Charros", 48, 45], ["Algodoneros", 46, 47], ["Rieleros", 42, 47], ["Saraperos", 38, 55],
    ["Tecos", 36, 57], ["Dorados", 35, 58],
  ],
};

const SCHEDULE = [
  { date: "2026-08-08", stage: "Primer Playoff", games: [
    { a: "Algodoneros", b: "Toros", ra: 2, rb: 5 },
    { a: "Acereros", b: "Caliente", ra: 12, rb: 6 },
  ]},
  { date: "2026-08-09", stage: "Primer Playoff", games: [
    { a: "Algodoneros", b: "Toros", ra: 8, rb: 2 },
    { a: "Acereros", b: "Caliente", ra: 3, rb: 9 },
    { a: "Charros", b: "Sultanes", ra: 1, rb: 3 },
  ]},
  { date: "2026-08-10", stage: "Primer Playoff", games: [
    { a: "Charros", b: "Sultanes", ra: 2, rb: 3 },
  ]},
  { date: "2026-08-11", stage: "Primer Playoff", games: [
    { a: "Toros", b: "Algodoneros", ra: 9, rb: 3 },
    { a: "Caliente", b: "Acereros", ra: 7, rb: 0 },
  ]},
  { date: "2026-08-12", stage: "Primer Playoff", games: [
    { a: "Toros", b: "Algodoneros", ra: 4, rb: 0 },
    { a: "Caliente", b: "Acereros", ra: 7, rb: 2 },
    { a: "Sultanes", b: "Charros", ra: 6, rb: 3 },
  ]},
  { date: "2026-08-13", stage: "Primer Playoff", games: [
    { a: "Toros", b: "Algodoneros", ra: 12, rb: 6 },
    { a: "Caliente", b: "Acereros", ra: 10, rb: 1 },
    { a: "Sultanes", b: "Charros", ra: 5, rb: 15 },
  ]},
  { date: "2026-08-14", stage: "Primer Playoff", games: [
    { a: "Sultanes", b: "Charros", ra: 6, rb: 5 },
  ]},
  { date: "2026-08-18", stage: "Serie de Zona", games: [
    { a: "Charros", b: "Toros", ra: 0, rb: 4 },
    { a: "Sultanes", b: "Caliente", ra: 6, rb: 2 },
  ]},
  { date: "2026-08-19", stage: "Serie de Zona", games: [
    { a: "Charros", b: "Toros", ra: 5, rb: 3, extra: 11 },
    { a: "Sultanes", b: "Caliente", ra: 5, rb: 17 },
  ]},
  { date: "2026-08-21", stage: "Serie de Zona", games: [
    { a: "Toros", b: "Charros", ra: 2, rb: 1 },
    { a: "Caliente", b: "Sultanes", ra: 7, rb: 8, extra: 14 },
  ]},
  { date: "2026-08-22", stage: "Serie de Zona", games: [
    { a: "Toros", b: "Charros", ra: 7, rb: 2 },
    { a: "Caliente", b: "Sultanes", ra: 0, rb: 3 },
  ]},
  { date: "2026-08-23", stage: "Serie de Zona", games: [
    { a: "Toros", b: "Charros", ra: 3, rb: 2, extra: 10 },
    { a: "Caliente", b: "Sultanes", ra: 6, rb: 8 },
  ]},
  { date: "2026-08-28", stage: "Campeonato Zona Norte", games: [{ a: "Sultanes", b: "Toros", ra: 0, rb: 2 }] },
  { date: "2026-08-29", stage: "Campeonato Zona Norte", games: [{ a: "Sultanes", b: "Toros", ra: 4, rb: 0 }] },
  { date: "2026-08-31", stage: "Campeonato Zona Norte", games: [{ a: "Toros", b: "Sultanes", ra: 6, rb: 5, extra: 11 }] },
  { date: "2026-09-01", stage: "Campeonato Zona Norte", games: [{ a: "Toros", b: "Sultanes", ra: 15, rb: 7 }] },
  { date: "2026-09-02", stage: "Campeonato Zona Norte", games: [{ a: "Toros", b: "Sultanes", ra: 10, rb: 1 }] },
  { date: "2026-09-08", stage: "Serie del Rey", games: [{ a: "Olmecas", b: "Toros", ra: 7, rb: 1 }] },
  { date: "2026-09-09", stage: "Serie del Rey", games: [{ a: "Olmecas", b: "Toros", ra: 2, rb: 13 }] },
  { date: "2026-09-11", stage: "Serie del Rey", games: [{ a: "Toros", b: "Olmecas", ra: 2, rb: 0 }] },
  { date: "2026-09-12", stage: "Serie del Rey", games: [{ a: "Toros", b: "Olmecas", ra: 1, rb: 9 }] },
  { date: "2026-09-13", stage: "Serie del Rey", games: [{ a: "Toros", b: "Olmecas", ra: 6, rb: 5 }] },
  { date: "2026-09-15", stage: "Serie del Rey", games: [{ a: "Olmecas", b: "Toros", ra: 0, rb: 2 }] },
];

// Videos reales de la temporada 2026 de la LMB (Zona Norte), enlazados a YouTube.
// Para filtrar el video real, agrega `src` con la ruta de un archivo local
// (p. ej. src: "Assets/videos/ranking.mp4"). Los videos de YouTube no se
// pueden filtrar: el navegador no permite leer los píxeles de su reproductor.
// Sin `src` se muestra una escena animada de demostración.
const VIDEOS = {
  informativos: [
    { title: "Los mejores jugadores de la liga: ranking.", hue: 140, youtube: "https://www.youtube.com/watch?v=g83zZzIovfE" },
    { title: "Los mejores bateos de la temporada", hue: 20, youtube: "https://www.youtube.com/watch?v=Re8OFw7TRmo" },
    { title: "Mira el lineup para el juego de estrellas", hue: 210, youtube: "https://www.youtube.com/watch?v=vKUFPoQhw3A" },
    { title: "Los mejores picheos de la liga", hue: 90, youtube: "https://www.youtube.com/watch?v=1V8DIZbBdEQ" },
  ],
  liga: [
    { title: "Highlights partido Sultanes vs Dorados", hue: 260, youtube: "https://www.youtube.com/watch?v=oIrc-OpKwvg" },
    { title: "Los mejores outs de la temporada", hue: 0, youtube: "https://www.youtube.com/watch?v=f6J4SF9ru0A" },
    { title: "Los Sultanes hacen historia en la temporada", hue: 190, youtube: "https://www.youtube.com/watch?v=5FTNPGs6Les" },
    { title: "Aprende a pichar con Gabriel Ponce", hue: 45, youtube: "https://www.youtube.com/watch?v=gv8LDvy-m-s" },
  ],
};

const TESTIMONIALS = [
  { text: "Muy buena página, recomendada para todo fan del beisbol mexicano.", name: "Karla M." },
  { text: "El calendario está actualizado y bien hecho, me es de utilidad.", name: "Luis F." },
  { text: "¡Vamos Sultanes!", name: "Ana G." },
];
