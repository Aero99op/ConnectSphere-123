import type { NextAuthConfig } from "next-auth"

// SECURITY FIX: Lightweight auth config for Edge compatibility (Cloudflare bundle size optimization)
// This file MUST NOT import heavy libraries like Supabase or PBKDF2 logic.
export const authConfig = {
    pages: {
        signIn: '/login',
        error: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isProtected = nextUrl.pathname.startsWith('/dashboard') || 
                               nextUrl.pathname.startsWith('/create') || 
                               nextUrl.pathname.startsWith('/report');
            
            if (isProtected && !isLoggedIn) return false;
            return true;
        },
    },
    providers: [], // Empty here, populated in auth.ts
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60,
    },
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === 'production' ? `__Secure-authjs.session-token` : `authjs.session-token`,
            options: {
                httpOnly: true,
                sameSite: "strict",
                path: "/",
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },
    trustHost: true,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
