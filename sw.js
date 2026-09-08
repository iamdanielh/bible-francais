const CACHE = "biblefr-v3";
const DATA_ASSETS = ["data/bible.json", "data/dict.json"];

// Install: pre-cache the big immutable data files for offline use.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(DATA_ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // Data JSONs: cache-first (big, rarely change, needed for offline).
  if (DATA_ASSETS.some((a) => path.endsWith(a))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((resp) => {
          const copy = resp.clone();
          if (resp.ok) caches.open(CACHE).then((c) => c.put(event.request, copy));
          return resp;
        });
      })
    );
    return;
  }

  // Everything else (HTML, JS, CSS, manifest, icons): network-first so updates
  // from this repo reach users immediately; fall back to cache when offline.
  event.respondWith(
    fetch(event.request).then((resp) => {
      const copy = resp.clone();
      if (resp.ok && event.request.method === "GET") {
        caches.open(CACHE).then((c) => c.put(event.request, copy));
      }
      return resp;
    }).catch(() => caches.match(event.request))
  );
});