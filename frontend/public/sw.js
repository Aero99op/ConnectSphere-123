const CACHE_NAME = 'connect-v4'; // Upgraded version to clear old stale caches
const ASSETS_TO_CACHE = [
    '/',
    '/settings/games',
    '/manifest.json',
    '/logo.svg',
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Dynamic Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 🛡️ ONLY HANDLE HTTP/HTTPS
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // 🛡️ SKIP SW FOR MEDIA & DYNAMIC DATA
    // 1. Large Media Providers (Catbox, Apple, etc.)
    // 2. Local Media (mp4, mp3, webm) - Browsers handle Range requests better than SW
    // 3. Next.js Data Fetching (_next/data) - Prevents stale "Disappearing Music"
    // 4. API calls
    if (
        url.pathname.startsWith('/api') || 
        url.pathname.includes('_next/data') ||
        url.pathname.match(/\.(mp4|mp3|webm|wav|m4a|ogg)$/i) ||
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('catbox.moe') ||
        url.hostname.includes('mzstatic.com') ||
        url.hostname.includes('apple.com')
    ) {
        return; // Let browser handle normally
    }

    // Navigation Fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/'))
        );
        return;
    }

    // Static Assets: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});

// ------------- WEB PUSH -------------
self.addEventListener('push', (event) => {
    event.waitUntil(
        fetch('/api/push/latest')
            .then(res => res.json())
            .then(data => {
                return self.registration.showNotification(data.title || 'ConnectSphere', {
                    body: data.body || 'New activity',
                    icon: '/logo.svg',
                    badge: '/logo.svg',
                    data: { url: data.url || '/' }
                });
            })
            .catch(() => {
                return self.registration.showNotification('ConnectSphere', {
                    body: 'New background activity received.',
                    icon: '/logo.svg'
                });
            })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});
