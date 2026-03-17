const CACHE_NAME = 'connect-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/settings/games',
    '/manifest.json',
    '/logo.svg',
];

// Install Event - Cache Core Assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching core assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    console.log('[SW] Activated');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip API calls and Supabase traffic (handled in app space via IndexedDB)
    if (url.pathname.startsWith('/api') || 
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('catbox.moe')) {
        return;
    }

    // Navigation Fallback: Serve the root shell for any page navigation
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                console.log('[SW] Offline: Serving cached root for navigation');
                return caches.match('/');
            })
        );
        return;
    }

    // Static Assets & Chunks: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache with fresh version
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    const requestUrl = new URL(event.request.url);
                    if ((requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:') && event.request.method === 'GET') {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                }
                return networkResponse;
            }).catch((err) => {
                console.log('[SW] Fetch failed, returning cache if available:', url.pathname);
                return cachedResponse;
            });

            return cachedResponse || fetchPromise;
        })
    );
});
