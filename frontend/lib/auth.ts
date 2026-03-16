import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

/**
 * Sign a Supabase-compatible JWT with the Supabase JWT secret.
 * This makes `auth.uid()` in RLS policies return our custom user ID.
 * Server-side only — never expose the secret to the browser.
 */
export async function signSupabaseJWT(userId: string, email: string, role: string = 'authenticated'): Promise<string | null> {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
        console.error('⚠️ SUPABASE_JWT_SECRET is not set — skipping Supabase JWT signing');
        return null;
    }

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
 * Enhanced Non-Deterministic UUID v5 implementation.
 * Combines email with an optional salt to prevent easy ID discovery.
 */
export async function emailToUUID(email: string, salt?: string): Promise<string> {
    try {
        const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
        const nsHex = NAMESPACE.replace(/-/g, '');
        const nsBytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            nsBytes[i] = parseInt(nsHex.substring(i * 2, i * 2 + 2), 16);
        }

        // Use global salt if available to prevent deterministic ID mapping
        // Passing an explicit empty string "" bypasses the global salt (used for legacy checks)
        // SECURITY FIX (CRIT-002): Use server-only UUID_SALT — never NEXT_PUBLIC_ prefix
        const finalSalt = salt !== undefined ? salt : (process.env.UUID_SALT || '');
        const nameBytes = new TextEncoder().encode((email.toLowerCase().trim() + finalSalt));

        const combined = new Uint8Array(16 + nameBytes.length);
        combined.set(nsBytes);
        combined.set(nameBytes, 16);

        const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
        const hashBytes = new Uint8Array(hashBuffer);

        hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
        hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

        const hex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch (e) {
        console.error("UUID Generation Failed:", e);
        return crypto.randomUUID();
    }
}

/**
 * Hardened PBKDF2 Password Hashing (Edge Compatible).
 * 100,000 iterations of SHA-256 for maximum brute-force resistance.
 */
export async function hashPassword(password: string): Promise<string> {
    try {
        const encoder = new TextEncoder();
        const salt = encoder.encode(process.env.AUTH_PASSWORD_SALT || "connectsphere_hardened_v2");
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );

        return Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error("PBKDF2 Hashing Failed:", e);
        // SECURITY: Never silently fall back to weak SHA-256.
        // A weak hash stored once is weak forever.
        throw new Error("Password hashing failed. Crypto API unavailable.");
    }
}

/**
 * Legacy SHA-256 Hash for backward compatibility checks.
 */
export async function legacyHash(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + (process.env.AUTH_PASSWORD_SALT || "connectsphere_salt"));
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create an authenticated Supabase client using a custom JWT.
 */
export function createAuthenticatedSupabaseClient(accessToken: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
 */
export function createAdminSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) {
        console.error('⚠️ NEXT_PUBLIC_SUPABASE_URL is not set — admin Supabase client unavailable');
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }
    if (!serviceRoleKey) {
        console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set — admin Supabase client unavailable');
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
