// Caches the static app shell (HTML/CSS/JS/logo) so NewsScope itself opens
// offline. It deliberately does NOT cache NewsAPI requests: those need a
// live connection and carry your API key, so they always go straight to
// the network. Offline reading of saved articles works through
// localStorage in script.js and doesn't depend on this file at all.

const CACHE_NAME = "newsscope-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./newsLogo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests (the app shell). Everything else
  // -- especially NewsAPI calls -- passes straight through to the network.
  if (url.origin !== self.location.origin || event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});