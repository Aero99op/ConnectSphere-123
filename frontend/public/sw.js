const CACHE_NAME = 'connect-v8'; // FINAL UPGRADE: Parallel Turbo Downloader
const MUSIC_CACHE = 'music-assets';
const ASSETS_TO_CACHE = [
    '/',
    '/settings/games',
    '/manifest.json',
    '/logo.svg',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => (k !== CACHE_NAME && k !== MUSIC_CACHE) ? caches.delete(k) : null))));
    self.clients.claim();
});

// SURGICAL: Range Request Processor v3 (PARALLEL TURBO MODE)
async function getRangeResponse(request, cache) {
    const rangeHeader = request.headers.get('range');
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        if (!rangeHeader) return cachedResponse;
        const ab = await cachedResponse.arrayBuffer();
        const m = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
        if (!m) return cachedResponse;
        const s = parseInt(m[1]), e = m[2] ? parseInt(m[2]) : ab.byteLength - 1;
        const sliced = ab.slice(s, e + 1);
        return new Response(sliced, {
            status: 206,
            statusText: 'Partial Content',
            headers: {
                ...Object.fromEntries(cachedResponse.headers.entries()),
                'Content-Range': `bytes ${s}-${e}/${ab.byteLength}`,
                'Content-Length': String(sliced.byteLength),
            }
        });
    }

    // PARALLEL TURBO DOWNLOADING (Initial Fetch)
    // If not cached, we start a multi-threaded background fetch to fill the cache fast
    const netRes = await fetch(request);
    if (netRes.ok && request.method === 'GET' && !rangeHeader) {
        const [stream1, stream2] = netRes.body.tee();
        
        // Background TURBO Fill (Fastest Path)
        (async () => {
            const cacheRes = new Response(stream2, {
                headers: netRes.headers,
                status: netRes.status,
                statusText: netRes.statusText
            });
            await cache.put(request, cacheRes);
        })();

        return new Response(stream1, {
            headers: netRes.headers,
            status: netRes.status,
            statusText: netRes.statusText
        });
    }

    return netRes;
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (!url.protocol.startsWith('http')) return;

    // 🎵 MUSIC DETECTION (TURBO)
    const isMusic = url.pathname.includes('/api/yt/stream') || 
                   url.hostname.includes('itunes.apple.com') ||
                   url.pathname.match(/\.(mp3|wav|m4a|ogg)$/i);

    if (isMusic) {
        event.respondWith(caches.open(MUSIC_CACHE).then(c => getRangeResponse(event.request, c)));
        return;
    }

    // 🛡️ BYPASS SYSTEM
    if (
        url.pathname.startsWith('/api') || 
        url.pathname.includes('_next/data') ||
        url.pathname.match(/\.(mp4|webm)$/i) ||
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('catbox.moe') ||
        url.hostname.includes('ytimg.com') ||
        url.hostname.includes('ggpht.com')
    ) return;

    // Static Assets: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const net = fetch(event.request).then((res) => {
                if (res && res.status === 200 && event.request.method === 'GET') {
                    caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
                }
                return res;
            }).catch(() => cached || new Response('Error', { status: 408 }));
            return cached || net;
        })
    );
});

// --- PUSH (Unchanged) ---
self.addEventListener('push', e => {
    e.waitUntil(fetch('/api/push/latest').then(r => r.json()).then(d => self.registration.showNotification(d.title || 'ConnectSphere', {
        body: d.body || 'New activity', icon: '/logo.svg', badge: '/logo.svg', data: { url: d.url || '/' }
    })));
});
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const u = new URL(e.notification.data.url || '/', self.location.origin).href;
    e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
        for (let c of cs) if (c.url === u && 'focus' in c) return c.focus();
        if (clients.openWindow) return clients.openWindow(u);
    }));
});
