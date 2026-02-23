import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimit = new Map();

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req, res })

    const ip = req.ip ?? '127.0.0.1';

    // 1. Rate Limiting (Simple In-Memory for single instance/dev)
    // Note: For distributed/serverless scaling, use Redis (Upstash)
    if (req.nextUrl.pathname.startsWith('/api')) {
        const limit = 100; // requests per minute
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

    const {
        data: { session },
    } = await supabase.auth.getSession()

    // Protected Routes
    // Note: Profile is now accessible to everyone (Guest view handled in component)
    const startPaths = ['/dashboard', '/create', '/report']
    const isProtected = startPaths.some(path => req.nextUrl.pathname.startsWith(path))

    if (isProtected && !session) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // Auth Routes (Login) - Redirect to Feed if already logged in
    if (req.nextUrl.pathname.startsWith('/login') && session) {
        return NextResponse.redirect(new URL('/', req.url))
    }

    return res
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/create/:path*',
        '/profile/:path*',
        '/report',
        '/login'
    ],
}
