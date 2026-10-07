// Service worker mínimo para que Base-Hub se pueda "instalar" en el
// teléfono (ícono en pantalla de inicio, se abre sin la barra del navegador)
// y siga funcionando sin conexión una vez visitada cada pantalla.
// No intercepta peticiones a otros orígenes: esas siempre van directo a la
// red. Las librerías de AR (vendor/) y los logos se guardan en caché la
// primera vez que se usan.

const CACHE = "basehub-v6";
const CORE_ASSETS = [
  "index.html",
  "style.css",
  "app.js",
  "ar.js",
  "data.js",
  "filters.js",
  "ar-libs.js",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
