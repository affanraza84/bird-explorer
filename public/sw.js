// Bird Explorer Service Worker
// Provides offline application shell and asset caching for outdoor use.

const CACHE_NAME = "bird-explorer-v1";

const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: precache the core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: purge obsolete caches & claim active clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: serve cached shell, cache static assets, bypass API endpoints
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache backend API calls (e.g. /api/identify-bird, /api/generate-quest)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "AI identification is unavailable offline. Your journal and outdoor tools are still available.",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // 2. Navigation requests: Network-first, fall back to cached application shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fall back to root application shell
          const rootCached = await caches.match("/");
          if (rootCached) {
            return rootCached;
          }
          return new Response(
            "Bird Explorer is offline. Please launch the app once while connected to precache the shell.",
            { status: 503, headers: { "Content-Type": "text/plain" } }
          );
        })
    );
    return;
  }

  // 3. Static assets (_next/static, css, js, images, fonts): Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and update cache in background (stale-while-revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore offline network error when serving from cache
          });
        return cachedResponse;
      }

      // Not in cache, fetch from network and cache for next offline use
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});
