# Base-Hub

Aplicación web (PWA) de la **Liga Mexicana de Béisbol – Zona Norte** con Realidad Aumentada y procesamiento de imágenes en vivo. Proyecto de la materia **Procesamiento de Imágenes**, Grupo 53, Agosto – Diciembre 2026.

## Autores

| Nombre | Matrícula |
| --- | --- |
| Derek Alejandro Luna Hernandez | 1969757 |
| Javier Peña Reyes | 2109195 |

## Funciones

- **Inicio, ¿Quiénes somos? e Historia del béisbol**: noticias, presentación del proyecto y línea del tiempo.
- **Equipos y plantillas**: los 10 equipos de la Zona Norte con estadísticas de temporada y carrera de cada jugador.
- **Calendario**: resultados de la postemporada 2026, tabla final del rol regular y fechas clave.
- **Trivia**: trivias de 5 preguntas que otorgan insignias 3D de oro, plata o bronce.
- **Galería**:
  - *Videos* con filtros de procesamiento de imagen por píxel (desenfoque, pixelado, cámara térmica, ajuste de color, pastel, alta saturación y suavizado).
  - *Insignias* ganadas en las trivias.
  - *Fotos AR*: las fotos tomadas en la Realidad Aumentada, guardadas dentro de la app (IndexedDB), con opción de descargar o borrar.
- **Realidad Aumentada**: reconoce el logo de cada equipo con MindAR y muestra su modelo 3D (three.js) con acciones de diorama, info, animación, celebración, video, marcador en vivo, sonido y foto.
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
| `photos.js` | Galería de fotos AR (IndexedDB) |
| `help.js` | Contenido del botón de ayuda “?” |
| `badges3d.js`, `sounds.js` | Insignias 3D y sonidos de estadio (WebAudio) |
| `sw.js`, `manifest.webmanifest` | Service worker y datos de instalación |
| `Assets/` | Imágenes, íconos, modelos `.glb` y marcadores AR |
| `vendor/` | three.js r160 y MindAR |

La documentación completa, con capturas de pantalla, se entrega por separado en PDF.
