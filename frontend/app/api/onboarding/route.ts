export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createAdminSupabaseClient, emailToUUID } from '@/lib/auth';

// Edge-compatible sanitizer (DOMPurify crashes in Edge Runtime — no DOM)
// Strengthened against entity encoding, unicode, and null byte bypasses
function edgeSanitize(input: string): string {
    if (!input) return "";
    let s = input;
    // Strip null bytes
    s = s.replace(/\0/g, '');
    // SECURITY FIX (MED-007): Decode HTML entities in a loop to catch double/triple encoding
    let prev = '';
    for (let i = 0; i < 3 && s !== prev; i++) {
        prev = s;
        s = s.replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        s = s.replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
        s = s.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
        s = s.replace(/&amp;/gi, '&');
    }
    // Strip angle brackets and script-related patterns
    s = s.replace(/[<>]/g, '');
    s = s.replace(/javascript\s*:/gi, '');
    s = s.replace(/on\w+\s*=/gi, '');
    s = s.replace(/\\u003[cC]/g, '').replace(/\\u003[eE]/g, ''); // Unicode escapes for < >
    // Only allow safe characters for profile fields (letters, numbers, spaces, basic punctuation)
    s = s.replace(/[^\p{L}\p{N}\s.,!?@#$%&*()_+\-=:;'"\/\\[\]{}|~`^]/gu, '');
    return s.trim().slice(0, 500);
}

// GET /api/onboarding — Check if user is onboarded
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Not authenticated', isOnboarded: true, profileExists: false }, { status: 401 });
        }

        // Use the ID from the session (already handled salted vs legacy in auth.ts)
        const userId = (session.user as any).id;
        const adminSupabase = createAdminSupabaseClient();

        const { data, error } = await adminSupabase
            .from('profiles')
            .select('is_onboarded')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Onboarding check error:', error);
            // SECURITY FIX (HIGH-02): Return 500, not 200, on DB errors
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
        // SECURITY FIX (HIGH-02): Return 500, not 200, on catch errors
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/onboarding — Complete onboarding
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const body = await req.json();
        const { country, age, interests } = body;

        if (!country || !age || !interests || interests.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const adminSupabase = createAdminSupabaseClient();

        const { error } = await adminSupabase
            .from('profiles')
            .upsert({
                id: userId,
                email: session.user.email,
                country: edgeSanitize(country.trim()),
                age: parseInt(age),
                interests: interests,
                is_onboarded: true,
                personalization: { setup_date: new Date().toISOString() },
            }, { onConflict: 'id' });

        if (error) {
            console.error('Onboarding upsert error:', error);
            // SECURITY FIX (LOW-003): Never leak internal DB error messages
            return NextResponse.json({ error: 'Failed to save onboarding data' }, { status: 500 });
        }

        return NextResponse.json({ success: true, updated: true });
    } catch (err: any) {
        console.error('Onboarding POST error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
