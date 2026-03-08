import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/auth';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        // SECURITY: Require authentication
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const id = searchParams.get('id');

        if (!email || !id) return NextResponse.json({ error: "Missing email or id" }, { status: 400 });

        // SECURITY: Only allow fixing your own profile
        if (session.user.email !== email) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const adminSupabase = createAdminSupabaseClient();

        // Check if exists
        const { data: existing } = await adminSupabase.from('profiles').select('id').eq('id', id).maybeSingle();

        if (existing) {
            return NextResponse.json({ message: "Profile already exists, no fix needed!" });
        }

        // Force insert
        const { error } = await adminSupabase.from('profiles').insert({
            id: id,
            email: email,
            username: email.split('@')[0] + Math.floor(Math.random() * 1000),
            full_name: email.split('@')[0] + " (Auto Fixed)",
            role: 'citizen',
            is_onboarded: true,
            avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=Fixed`,
        });

        if (error) {
            console.error('[force-fix-profile] Error:', error);
            return NextResponse.json({ error: 'Profile creation failed' }, { status: 500 });
        }

        return NextResponse.json({ message: "Successfully injected profile! Go back and refresh." });
    } catch (e: any) {
        console.error('[force-fix-profile] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
