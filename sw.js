const CACHE = "biblefr-v2";
const ASSETS = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/dict.js",
  "manifest.webmanifest",
  "data/bible.json",
  "data/dict.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((resp) => {
        const copy = resp.clone();
        if (resp.ok && event.request.method === "GET") {
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      });
    })
  );
});
