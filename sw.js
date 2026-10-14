// Service worker para que Base-Hub se pueda "instalar" en el teléfono (ícono
// en pantalla de inicio, se abre sin la barra del navegador) y siga
// funcionando sin conexión una vez visitada cada pantalla.
// No intercepta peticiones a otros orígenes: esas siempre van directo a la red.
//
// Estrategias:
//  - Código y páginas (html, js, css, json, manifest): primero la red, y la
//    caché solo si no hay conexión. Así nunca se mezcla un index.html nuevo
//    con un app.js viejo después de publicar cambios.
//  - Librerías de vendor/, imágenes y targets.mind: primero la caché (no
//    cambian y pesan mucho), y se guardan la primera vez que se usan.

const CACHE = "basehub-v12";
const CORE_ASSETS = [
  "index.html",
  "style.css",
  "app.js",
  "ar.js",
  "data.js",
  "trivias.js",
  "badges3d.js",
  "filters.js",
  "ar-libs.js",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  // cache: "reload" evita que la caché HTTP del navegador entregue copias viejas.
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS.map((u) => new Request(u, { cache: "reload" }))))
      .catch(() => {})
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

function save(request, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return res;
}

function isCode(url, request) {
  if (request.mode === "navigate") return true;
  if (url.pathname.includes("/vendor/")) return false;
  return /\.(html|js|css|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== "GET") return;

  if (isCode(url, e.request)) {
    e.respondWith(
      fetch(e.request, { cache: "no-cache" })
        .then((res) => save(e.request, res))
        .catch(() => caches.match(e.request).then((cached) =>
          cached || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => save(e.request, res)))
  );
});
