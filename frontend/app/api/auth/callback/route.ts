import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'edge';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = createRouteHandlerClient({ cookies })
        await supabase.auth.exchangeCodeForSession(code)
    }

    // SECURITY FIX (HIGH-007): Validate redirect origin against allowlist
    const allowedOrigins = [
        'https://connectsphere-123.pages.dev',
        'http://localhost:3000',
    ];
    
    const redirectOrigin = allowedOrigins.includes(requestUrl.origin) 
        ? requestUrl.origin 
        : (process.env.NEXTAUTH_URL || 'https://connectsphere-123.pages.dev');

    return NextResponse.redirect(redirectOrigin)
}
