import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Sign a Supabase-compatible JWT with the Supabase JWT secret.
 * This makes `auth.uid()` in RLS policies return our custom user ID.
 * Server-side only — never expose the secret to the browser.
 */
export async function signSupabaseJWT(userId: string, email: string, role: string = 'authenticated') {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set');

    const secretKey = new TextEncoder().encode(secret);

    const jwt = await new SignJWT({
        sub: userId,
        email: email,
        role: role,       // Supabase RLS checks this: must be "authenticated"
        iss: 'supabase',  // Supabase expects this issuer
        aud: 'authenticated',
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('7d') // 7 day expiry, NextAuth will refresh
        .sign(secretKey);

    return jwt;
}

/**
 * Create an authenticated Supabase client using a custom JWT.
 * This client has the same powers as one using Supabase Auth — 
 * RLS, Realtime, everything works because `auth.uid()` reads the JWT `sub`.
 */
export function createAuthenticatedSupabaseClient(accessToken: string) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        realtime: {
            params: {
                apikey: supabaseAnonKey,
            },
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });
}

/**
 * Create an admin Supabase client using the service role key.
 * Used server-side ONLY for user creation/management.
 * Bypasses RLS — use with extreme caution.
 */
export function createAdminSupabaseClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
