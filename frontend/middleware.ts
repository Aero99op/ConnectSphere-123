import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const rateLimit = new Map();

export default auth((req: any) => {
    const res = NextResponse.next()
    //@ts-ignore - ip might not be typed on NextAuthRequest
    const ip = req.ip ?? '127.0.0.1';

    // 1. Rate Limiting (Simple In-Memory for single instance/dev)
    if (req.nextUrl.pathname.startsWith('/api')) {
        const limit = 100;
        const windowMs = 60 * 1000;

        const record = rateLimit.get(ip) ?? { count: 0, startTime: Date.now() };

        if (Date.now() - record.startTime > windowMs) {
            record.count = 1;
            record.startTime = Date.now();
        } else {
            record.count++;
        }

        rateLimit.set(ip, record);

        if (record.count > limit) {
            return new NextResponse(JSON.stringify({ error: "Too Many Requests" }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // 2. Auth check via NextAuth v5
    const token = req.auth;

    // Protected Routes
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

    return res
})

export const config = {
    matcher: [
        '/',
        '/dashboard/:path*',
        '/create/:path*',
        '/profile/:path*',
        '/report',
        '/login'
    ],
}
