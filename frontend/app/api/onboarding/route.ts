export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createAdminSupabaseClient } from '@/lib/auth';

// Edge-compatible UUID v5 implementation using Web Crypto API
async function emailToUUID(email: string): Promise<string> {
    const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    // Convert namespace UUID string to bytes
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

// GET /api/onboarding — Check if user is onboarded
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ isOnboarded: true, profileExists: false }, { status: 200 });
        }

        const userId = await emailToUUID(session.user.email);
        const adminSupabase = createAdminSupabaseClient();

        const { data, error } = await adminSupabase
            .from('profiles')
            .select('is_onboarded')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Onboarding check error:', error);
            return NextResponse.json({ isOnboarded: true, profileExists: false }, { status: 200 });
        }

        if (!data) {
            return NextResponse.json({ isOnboarded: false, profileExists: false }, { status: 200 });
        }

        return NextResponse.json({
            isOnboarded: data.is_onboarded === true,
            profileExists: true,
        });
    } catch (err) {
        console.error('Onboarding API error:', err);
        return NextResponse.json({ isOnboarded: true, profileExists: false }, { status: 200 });
    }
}

// POST /api/onboarding — Complete onboarding
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = await emailToUUID(session.user.email);
        const body = await req.json();
        const { country, age, interests } = body;

        if (!country || !age || !interests || interests.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const adminSupabase = createAdminSupabaseClient();

        const { error } = await adminSupabase
            .from('profiles')
            .update({
                country: country.trim(),
                age: parseInt(age),
                interests: interests,
                is_onboarded: true,
                personalization: { setup_date: new Date().toISOString() },
            })
            .eq('id', userId);

        if (error) {
            console.error('Onboarding update error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Onboarding POST error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
