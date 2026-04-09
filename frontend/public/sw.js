const CACHE_NAME = 'connect-v9-FINAL-KILL_SWITCH'; 
const ASSETS_TO_CACHE = [
    '/',
    '/manifest.json',
    '/logo.svg',
];

self.addEventListener('install', (e) => {
    // FORCE UPDATE: Immediately install the new worker
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting(); 
});

self.addEventListener('activate', (e) => {
    // NUKE PROTOCOL: Delete ALL existing caches to clear any corrupted data
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // INSTANT TAKEOVER: Take control of all pages without requiring a reload
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (!url.protocol.startsWith('http')) return;

    // 🛡️ MEDIA BYPASS - FORCE NATIVE BROWSER ENGINE
    // Never touch audio/video streams with SW. It breaks Range requests.
    const isMedia = url.pathname.match(/\.(mp4|webm|mp3|wav|m4a|ogg)$/i) || 
                    url.pathname.includes('/api/yt/stream') ||
                    url.hostname.includes('itunes.apple.com');

    if (
        isMedia ||
        url.pathname.startsWith('/api') || 
        url.pathname.includes('_next/data') ||
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('catbox.moe') ||
        url.hostname.includes('ytimg.com') ||
        url.hostname.includes('ggpht.com')
    ) {
        return; // Allow the browser to handle it natively
    }

    // Static Assets: Safe Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const net = fetch(event.request).then((res) => {
                if (res && res.status === 200 && event.request.method === 'GET' && !res.bodyUsed) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
                }
                return res;
            }).catch(() => cached || new Response('Network Error', { status: 408 }));
            return cached || net;
        })
    );
});

// ------------- WEB PUSH -------------
self.addEventListener('push', (event) => {
    event.waitUntil(
        fetch('/api/push/latest').then(res => res.json()).then(data => {
            return self.registration.showNotification(data.title || 'ConnectSphere', {
                body: data.body || 'New activity',
                icon: '/logo.svg',
                badge: '/logo.svg',
                data: { url: data.url || '/' }
            });
        }).catch(() => {
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
            for (let client of windowClients) if (client.url === urlToOpen && 'focus' in client) return client.focus();
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});

// Done
