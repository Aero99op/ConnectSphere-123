import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function GET() {
    const session = await auth();
    return NextResponse.json({
        authenticated: !!session,
        userId: (session?.user as any)?.id,
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
