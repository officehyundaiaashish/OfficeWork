const CACHE_NAME = "tasker-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./icon.svg?v=2",
  "./icon-192.png?v=2",
  "./icon-512.png?v=2",
  "./manifest.json?v=2",
  "./done.wav",
  "./notdone.wav"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const isHtmlOrManifest = 
    e.request.mode === "navigate" || 
    e.request.url.includes("index.html") || 
    e.request.url.includes("manifest.json");

  if (isHtmlOrManifest) {
    // Network First strategy
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(e.request) || caches.match("./index.html"))
    );
  } else {
    // Stale-While-Revalidate strategy for other assets
    e.respondWith(
      caches.match(e.request).then(cachedResponse => {
        const fetchPromise = fetch(e.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Ignore network errors
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});
