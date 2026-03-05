import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const rateLimit = new Map();

async function checkRateLimit(ip: string) {
    // 1. Rate Limiting (Simple In-Memory for single instance/dev)
    // Structured to be async-ready for future Redis integration
    const limit = 100;
    const windowMs = 60 * 1000;
    const now = Date.now();

    const record = rateLimit.get(ip) ?? { count: 0, startTime: now };

    if (now - record.startTime > windowMs) {
        record.count = 1;
        record.startTime = now;
    } else {
        record.count++;
    }

    rateLimit.set(ip, record);
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

    // 1. Rate Limiting
    if (req.nextUrl.pathname.startsWith('/api')) {
        const isAllowed = await checkRateLimit(ip);
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
        return NextResponse.redirect(new URL('/role-selection', req.url))
    }

    // Auth Routes (Login) - Redirect to Feed if already logged in
    if (req.nextUrl.pathname.startsWith('/login') && token) {
        return NextResponse.redirect(new URL('/', req.url))
    }

    // Catch-All Protected APIs
    // Explicitly add any API paths that MUST require auth to this list
    const protectedApiPaths = ['/api/user', '/api/settings'];
    const isProtectedApi = protectedApiPaths.some(path => req.nextUrl.pathname.startsWith(path))

    if (isProtectedApi && !token) {
        return new NextResponse(JSON.stringify({ error: "Unauthorized access" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return res
})

export const config = {
    matcher: [
        '/',
        '/dashboard/:path*',
        '/create/:path*',
        '/profile/:path*',
        '/report',
        '/login',
        '/api/:path*'
    ],
}
