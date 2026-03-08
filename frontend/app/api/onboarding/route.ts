export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createAdminSupabaseClient, emailToUUID } from '@/lib/auth';
import { sanitizeInput } from '@/lib/utils';

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

        const userId = (session.user as any).id;
        const body = await req.json();
        const { country, age, interests } = body;

        if (!country || !age || !interests || interests.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const adminSupabase = createAdminSupabaseClient();

        const { error } = await adminSupabase
            .from('profiles')
            .update({
                country: sanitizeInput(country.trim()),
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
