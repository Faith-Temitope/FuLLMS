// Minimal service worker for the FUL LMS installable PWA (local_fulokoja_lms).
// Deliberately does NOT cache dynamic/authenticated pages - this site is a live LMS with
// per-user session state, and stale cached HTML would show a student someone else's data.
// It only exists to satisfy browser installability criteria and to cache the small set of
// static PWA icon assets.

const STATIC_CACHE = 'fulokoja-pwa-static-v1';
const STATIC_ASSETS_PATTERN = /\/local\/fulokoja_lms\/pwa\//;

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    if (STATIC_ASSETS_PATTERN.test(url.pathname)) {
        event.respondWith(
            caches.open(STATIC_CACHE).then((cache) =>
                cache.match(event.request).then((cached) => {
                    const fetchPromise = fetch(event.request).then((response) => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                    return cached || fetchPromise;
                })
            )
        );
        return;
    }

    // Everything else (course pages, dashboard, grades, etc.) always goes to the network.
});
