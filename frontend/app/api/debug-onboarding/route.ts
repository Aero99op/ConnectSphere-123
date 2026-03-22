import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'edge';

// SECURITY FIX (HIGH-002): Debug endpoint now requires authentication
// and only returns data in development mode. Production returns nothing useful.
export async function GET() {
    const session = await auth();

    // SECURITY: Must be authenticated
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Only expose env check in development  
    if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
            authenticated: true,
            userId: (session.user as any)?.id,
            env: {
                SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                SUPABASE_JWT_SECRET: !!process.env.SUPABASE_JWT_SECRET,
                UUID_SALT: !!process.env.UUID_SALT,
            },
            runtime: process.env.NEXT_RUNTIME || 'unknown',
        });
    }

    // Production: Only return auth status — never leak env config
    return NextResponse.json({
        authenticated: true,
        status: 'ok'
    });
}
