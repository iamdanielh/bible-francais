// Versioned cache for the app shell (HTML/JS/CSS/icons). Bumped per release.
const CACHE = "biblefr-v31";
// The data files never change version → once downloaded they survive every SW
// update, so the app opens instantly on subsequent visits instead of
// re-downloading 18MB each time a new release ships.
const DATA_CACHE = "biblefr-data";
const DATA_ASSETS = ["data/bible.json", "data/dict.json", "data/tr/bible.json", "data/tr/dict.json", "data/tr/names.json"];

// Install: pre-cache the app shell and the big immutable data files for offline
// use. Failures are tolerated — stale-while-revalidate below repairs the cache
// at runtime, and a flaky fetch must never block this version from activating.
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then((cache) => cache.addAll(["./", "index.html", "css/style.css?v=51", "js/app.js?v=52", "js/dict.js?v=45", "js/tr-engine.js?v=47", "manifest.webmanifest"]).catch(() => {})),
      caches.open(DATA_CACHE).then((cache) => Promise.all(DATA_ASSETS.map((a) => cache.add(a).catch(() => {})))),
    ]).then(() => self.skipWaiting())
  );
});

// Activate: delete old app-shell caches (never the permanent data cache) and
// take control immediately.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // Data JSONs: stale-while-revalidate against the permanent data cache. Serve
  // the cached copy IMMEDIATELY (instant app open), refresh in the background.
  if (DATA_ASSETS.some((a) => path.endsWith(a))) {
    event.respondWith(
      caches.match(event.request, { cacheName: DATA_CACHE }).then((cached) => {
        const fresh = fetch(event.request, { cache: "no-store" }).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(DATA_CACHE).then((c) => c.put(event.request, copy));
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