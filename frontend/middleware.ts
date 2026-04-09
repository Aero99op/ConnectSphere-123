import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

const { auth } = NextAuth(authConfig);

const rateLimit = new Map();
// SECURITY FIX (VULN-007): Separate aggressive rate limit for auth endpoints
const authRateLimit = new Map();

async function checkRateLimit(ip: string, isAuthRoute: boolean = false) {
    const limit = isAuthRoute ? 1000 : 100; // Auth: UNLIMITED (1000/min), General: 100/min
    const windowMs = 60 * 1000;
    const now = Date.now();
    const store = isAuthRoute ? authRateLimit : rateLimit;

    const record = store.get(ip) ?? { count: 0, startTime: now };

    if (now - record.startTime > windowMs) {
        record.count = 1;
        record.startTime = now;
    } else {
        record.count++;
    }

    store.set(ip, record);
    // Cleanup old entries to prevent memory leak on edge
    if (store.size > 10000) {
        const cutoff = now - windowMs;
        for (const [key, val] of store) {
            if (val.startTime < cutoff) store.delete(key);
        }
    }
    return record.count <= limit;
}

export default auth(async (req: any) => {
    const res = NextResponse.next()

    // Secure IP Extraction (Cloudflare / Proxies)
    const forwardedFor = req.headers.get('x-forwarded-for')
    const cfConnectingIp = req.headers.get('cf-connecting-ip')
    const realIp = req.headers.get('x-real-ip')

    let ip = cfConnectingIp || realIp || '127.0.0.1'
    if (!ip && forwardedFor) {
        ip = forwardedFor.split(',')[0].trim()
    }
    if (ip === '127.0.0.1' && req.ip) {
        ip = req.ip
    }

    // 1. Rate Limiting (VULN-007: Auth routes get stricter limits)
    if (req.nextUrl.pathname.startsWith('/api')) {
        const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');
        const isAllowed = await checkRateLimit(ip, isAuthRoute);
        if (!isAllowed) {
            return new NextResponse(JSON.stringify({ error: "Too Many Requests" }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // 2. Auth check via NextAuth v5
    const token = req.auth;

    // Protected Frontend Routes
    const startPaths = ['/dashboard', '/create', '/report']
    const isProtected = startPaths.some(path => req.nextUrl.pathname.startsWith(path))

    if (isProtected && !token) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // Root path redirection for unauthenticated users
    if (req.nextUrl.pathname === '/' && !token) {
        // Only redirect to role-selection if NOT logged in
        return NextResponse.redirect(new URL('/role-selection', req.url))
    }

    if (req.nextUrl.pathname === '/role-selection' && token) {
        return NextResponse.redirect(new URL('/', req.url))
    }

    // Auth Routes (Login) - Redirect to Feed if already logged in
    if (req.nextUrl.pathname.startsWith('/login') && token) {
        return NextResponse.redirect(new URL('/', req.url))
    }

    // Catch-All Protected APIs
    // SECURITY FIX (VULN-003/010): ice-servers + onboarding require auth at middleware level
    const protectedApiPaths = ['/api/user', '/api/settings', '/api/ice-servers', '/api/onboarding'];
    const isProtectedApi = protectedApiPaths.some(path => req.nextUrl.pathname.startsWith(path))

    if (isProtectedApi && !token) {
        return new NextResponse(JSON.stringify({ error: "Unauthorized access" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 3. Inject Security Headers
    // CSP Configuration — No nonce (Next.js on Cloudflare can't inject nonces into hydration scripts)
    // Using 'unsafe-inline' for scripts is required for Next.js compatibility on Edge
    const backendUrl = process.env.BACKEND_URL || '';
    const cspHeader = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' blob: data: https://*.googleusercontent.com https://api.dicebear.com https://*.supabase.co https://*.unsplash.com https://catbox.moe https://*.catbox.moe https://files.catbox.moe https://i.imgur.com https://*.mzstatic.com https://*.ggpht.com https://yt3.ggpht.com https://*.ytimg.com https://i.ytimg.com https://s.ytimg.com https://yewtu.be https://*.projectsegfau.lt https://inv.thepixora.com https://inv.nadeko.net https://invidious.nerdvpn.de https://yt.chocolatemoo53.com https://iv.ggtyler.dev",
        "font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai",
        `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.pages.dev https://*.apinator.io wss://*.apinator.io https://accounts.google.com https://api.telegram.org https://ipapi.co https://api.dicebear.com https://lh3.googleusercontent.com https://images.unsplash.com https://catbox.moe https://*.catbox.moe https://files.catbox.moe https://*.soundhelix.com https://www.soundhelix.com https://itunes.apple.com https://*.mzstatic.com https://audio-ssl.itunes.apple.com https://*.apple.com https://yewtu.be https://*.projectsegfau.lt https://*.nerdvpn.de https://*.tux.im https://*.snopyta.org https://*.ytimg.com https://i.ytimg.com https://s.ytimg.com https://*.ggpht.com https://yt3.ggpht.com https://music.youtube.com https://inv.thepixora.com https://inv.nadeko.net https://yt.chocolatemoo53.com https://iv.ggtyler.dev https://pipedapi.kavin.rocks https://*.googlevideo.com${backendUrl ? ' ' + backendUrl : ''}`,
        "frame-src 'self' https://accounts.google.com",
        "media-src 'self' blob: https://*.supabase.co https://catbox.moe https://*.catbox.moe https://files.catbox.moe https://*.soundhelix.com https://*.mzstatic.com https://audio-ssl.itunes.apple.com https://*.apple.com https://yewtu.be https://*.projectsegfau.lt https://*.nerdvpn.de https://*.tux.im https://*.snopyta.org https://inv.thepixora.com https://inv.nadeko.net https://yt.chocolatemoo53.com https://iv.ggtyler.dev https://*.googlevideo.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
    ].join('; ');

    // Standard Security Headers
    res.headers.set('Content-Security-Policy', cspHeader);
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.headers.set('X-DNS-Prefetch-Control', 'on');
    res.headers.set('X-XSS-Protection', '1; mode=block');
    // SECURITY FIX (HIGH-04): Cross-Origin-Opener-Policy against Spectre-class attacks
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    // SECURITY FIX (MED-04): Explicitly strip framework fingerprint
    res.headers.delete('X-Powered-By');

    return res
})

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
