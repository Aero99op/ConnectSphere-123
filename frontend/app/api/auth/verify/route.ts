import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/auth';

export const runtime = 'edge';

// Edge-compatible UUID v5 implementation (Must match auth.ts)
async function getUUID(email: string): Promise<string> {
    const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const nsHex = NAMESPACE.replace(/-/g, '');
    const nsBytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        nsBytes[i] = parseInt(nsHex.substring(i * 2, i * 2 + 2), 16);
    }
    const nameBytes = new TextEncoder().encode(email.toLowerCase().trim());
    const combined = new Uint8Array(16 + nameBytes.length);
    combined.set(nsBytes);
    combined.set(nameBytes, 16);
    const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
    const hashBytes = new Uint8Array(hashBuffer);
    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
    const hex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Edge-compatible hashing helper (Must match auth.ts)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "connectsphere_salt");
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        const email = searchParams.get('email');

        if (!token || !email) {
            return NextResponse.redirect(new URL('/login?error=Invalid verification link', req.url));
        }

        const adminSupabase = createAdminSupabaseClient();

        // 1. Check if token is valid and not expired
        const { data: record, error: dbError } = await adminSupabase
            .from('verification_tokens')
            .select('*')
            .eq('identifier', email)
            .eq('token', token)
            .single();

        if (dbError || !record) {
            return NextResponse.redirect(new URL('/login?error=Verification link expired or invalid', req.url));
        }

        if (new Date(record.expires) < new Date()) {
            await adminSupabase.from('verification_tokens').delete().eq('token', token);
            return NextResponse.redirect(new URL('/login?error=Link has expired. Please send a new one.', req.url));
        }

        // 2. Verified! Handle Profile Creation or Update
        const metadata = record.metadata;

        if (metadata) {
            // SIGNUP FLOW: Create Profile now
            const userId = await getUUID(email);
            const hashedPassword = await hashPassword(metadata.password);

            const { error: insertError } = await adminSupabase
                .from('profiles')
                .insert({
                    id: userId,
                    email: email,
                    username: email.split('@')[0] + Math.floor(Math.random() * 1000),
                    full_name: metadata.fullName || email.split('@')[0],
                    role: metadata.role || 'citizen',
                    password_hash: hashedPassword,
                    email_verified: new Date().toISOString(),
                    is_onboarded: false,
                    avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(metadata.fullName || email)}`,
                });

            if (insertError) {
                console.error('Verify Signup Insert Error:', insertError);
                return NextResponse.redirect(new URL(`/login?error=Failed to create account: ${insertError.message}`, req.url));
            }
        } else {
            // LOGIN FLOW: Just update timestamp
            const { error: updateError } = await adminSupabase
                .from('profiles')
                .update({ email_verified: new Date().toISOString() })
                .eq('email', email);

            if (updateError) {
                console.error('Update Profile Verified Error:', updateError);
                return NextResponse.redirect(new URL('/login?error=Account verification failed internally', req.url));
            }
        }

        // 3. Cleanup Token and Success!
        await adminSupabase.from('verification_tokens').delete().eq('token', token);
        return NextResponse.redirect(new URL('/login?success=Email verified successfully! You can now login.', req.url));

    } catch (error: any) {
        console.error('Verify Link Handler Error:', error);
        return NextResponse.redirect(new URL('/login?error=Server error during verification', req.url));
    }
}
