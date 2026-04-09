const CACHE_NAME = 'connect-v6'; // Upgraded for Macrosecond Music Engine
const MUSIC_CACHE = 'music-assets';
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
                    if (cache !== CACHE_NAME && cache !== MUSIC_CACHE) return caches.delete(cache);
                })
            );
        })
    );
    self.clients.claim();
});

// Helper for Range requests (The Core of Macrosecond Engine)
async function handleRangeRequest(request, cache) {
    const rangeHeader = request.headers.get('range');
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        if (!rangeHeader) return cachedResponse;

        const arrayBuffer = await cachedResponse.arrayBuffer();
        const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
        if (!match) return cachedResponse;
        
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : arrayBuffer.byteLength - 1;

        const slicedBuffer = arrayBuffer.slice(start, end + 1);
        return new Response(slicedBuffer, {
            status: 206,
            statusText: 'Partial Content',
            headers: {
                ...Object.fromEntries(cachedResponse.headers.entries()),
                'Content-Range': `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
                'Content-Length': String(slicedBuffer.byteLength),
            },
        });
    }

    // Network Fallback with Cache Put
    const networkResponse = await fetch(request);
    
    // We only cache full responses (range-less) to serve slices later
    if (networkResponse.ok && request.method === 'GET' && !rangeHeader) {
        const responseToCache = networkResponse.clone();
        cache.put(request, responseToCache);
    }
    
    return networkResponse;
}

// Fetch Event - Dynamic Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 🛡️ ONLY HANDLE HTTP/HTTPS
    if (!url.protocol.startsWith('http')) return;

    // 🎵 SPECIAL HANDLING FOR MUSIC STREAMS (Zero-Buffer / Macrosecond)
    const isMusic = url.pathname.includes('/api/yt/stream') || 
                   url.hostname.includes('itunes.apple.com') ||
                   url.pathname.match(/\.(mp3|wav|m4a|ogg)$/i);

    if (isMusic) {
        event.respondWith(
            caches.open(MUSIC_CACHE).then(cache => handleRangeRequest(event.request, cache))
        );
        return;
    }

    // 🛡️ SKIP SW FOR OTHER LARGE MEDIA & DYNAMIC DATA
    if (
        url.pathname.startsWith('/api') || 
        url.pathname.includes('_next/data') ||
        url.pathname.match(/\.(mp4|webm)$/i) ||
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('catbox.moe') ||
        url.hostname.includes('ytimg.com') ||
        url.hostname.includes('ggpht.com')
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
            }).catch((err) => {
                if (cachedResponse) return cachedResponse;
                return new Response('Network error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
            });

            return cachedResponse || fetchPromise;
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
