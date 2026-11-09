# Base-Hub

Aplicación web (PWA) de la **Liga Mexicana de Béisbol – Zona Norte** con Realidad Aumentada y procesamiento de imágenes en vivo. Proyecto de la materia **Procesamiento de Imágenes**, Grupo 53, Agosto – Diciembre 2026.

## Autores

| Nombre | Matrícula | Rol |
| --- | --- | --- |
| Derek Alejandro Luna Hernandez | 1969757 | Programador |
| Javier Peña Reyes | 2109195 | Diseñador 3D |

## Funciones

- **Inicio, ¿Quiénes somos? e Historia del béisbol**: noticias, presentación del proyecto y línea del tiempo.
- **Equipos y plantillas**: los 10 equipos de la Zona Norte con estadísticas de temporada y carrera de cada jugador.
- **Calendario**: resultados de la postemporada 2026, tabla final del rol regular y fechas clave.
- **Minijuego Batazo**: juego de bateo en canvas; se toca la pantalla justo cuando la bola cruza el home para conectar sencillos, dobles, triples o jonrones. Una entrada de 3 outs, con conteo de bolas y strikes y corredores en base. Guarda la mejor partida de cada equipo y otorga un **trofeo 3D por equipo** (bronce con 5 carreras, plata con 8 y oro con 12), visible en Galería → Insignias.
- **Trivia**: trivias de 5 preguntas que otorgan insignias 3D de oro, plata o bronce.
- **Galería**:
  - *Videos* con filtros de procesamiento de imagen por píxel (desenfoque, pixelado, cámara térmica, ajuste de color, pastel, alta saturación y suavizado).
  - *Insignias*: trofeos de Batazo por equipo e insignias ganadas en las trivias.
  - *Fotos AR*: las fotos tomadas en la Realidad Aumentada, guardadas dentro de la app (IndexedDB), con opción de descargar o borrar.
- **Realidad Aumentada**: reconoce el logo de cada equipo con MindAR y muestra su modelo 3D (three.js) con acciones de diorama, info, animación, celebración, video, marcador en vivo, sonido y foto.
- **Créditos y fuentes**: pantalla (menú ☰) con el origen del contenido de terceros.
- **Ayuda “?”**: cada pantalla tiene un botón en la barra superior que explica cómo usarla.
- **PWA**: se instala en la pantalla de inicio y funciona sin conexión.

## Ejecutar

La app es estática (HTML, CSS y JavaScript, sin compilación). Basta con servir esta carpeta:

```bash
python -m http.server 8000
```

y abrir `http://localhost:8000`. La cámara y el service worker requieren `https://` o `localhost`; para probar la AR en el teléfono hay que publicarla con HTTPS (por ejemplo GitHub Pages).

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html`, `style.css` | Pantallas y estilos |
| `app.js` | Navegación, pantallas, galería y reproductor con filtros |
| `data.js`, `trivias.js` | Datos de equipos, jugadores, calendario, videos y trivias |
| `filters.js` | Motor de video y filtros de procesamiento de imagen |
| `ar.js`, `ar-libs.js` | Experiencia de Realidad Aumentada |
| `batazo.js` | Minijuego de bateo (canvas) |
| `photos.js` | Galería de fotos AR (IndexedDB) |
| `help.js` | Contenido del botón de ayuda “?” |
| `badges3d.js`, `sounds.js` | Insignias 3D y sonidos de estadio (WebAudio) |
| `sw.js`, `manifest.webmanifest` | Service worker y datos de instalación |
| `Assets/` | Imágenes, íconos, modelos `.glb` y marcadores AR |
| `vendor/` | three.js r160 y MindAR |

## Créditos y fuentes

- **Noticias, equipos y estadísticas:** Liga Mexicana de Béisbol (lmb.com.mx).
- **Calendario, resultados y tabla 2026:** Wikipedia, “Liga Mexicana de Béisbol 2026”, y comunicados de la liga.
- **Logos de los equipos:** marcas registradas de cada club y de la LMB, usados solo con fines educativos.
- **Fotografías de noticias y de “¿Quiénes somos?”:** Liga Mexicana de Béisbol y clubes correspondientes.
- **Videos (YouTube):** EL FANATICO DEL DEPORTE, ESPN MX, Claro Sports, Liga Mexicana de Beisbol Banorte y Niall O'Donohoe (el detalle por video está en la pantalla Créditos de la app).
- **Librerías:** [three.js](https://threejs.org) r160 (MIT) y [MindAR](https://github.com/hiukim/mind-ar-js) (MIT).
- **Contenido propio:** modelos 3D de las gorras y el diorama (Javier Peña Reyes); programación, insignias y trofeos 3D, minijuego Batazo, sonidos WebAudio, trivias, filtros, diseño e interfaz (Derek Alejandro Luna Hernandez).

La documentación completa, con capturas de pantalla, se entrega por separado en PDF.
