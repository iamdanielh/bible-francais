const CACHE = "biblefr-v11";
const DATA_ASSETS = ["data/bible.json", "data/dict.json"];

// Install: pre-cache the big immutable data files for offline use. Failures are
// tolerated — network-first serve repairs the cache at runtime, and a flaky
// fetch must never block this new version from activating.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(DATA_ASSETS.map((a) => cache.add(a).catch(() => {}))))
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

  // Data JSONs: stale-while-revalidate. Serve the cached copy IMMEDIATELY so
  // the app opens as fast as before (no 18MB re-download on every visit), then
  // refresh the cache in the background. On the very first visit there is no
  // cache yet, so it falls through to the network exactly once.
  if (DATA_ASSETS.some((a) => path.endsWith(a))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fresh = fetch(event.request, { cache: "no-store" }).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return resp;
        }).catch(() => cached);
        return cached || fresh;
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