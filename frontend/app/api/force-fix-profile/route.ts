import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/auth';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const id = searchParams.get('id');

        if (!email || !id) return NextResponse.json({ error: "Missing email or id" }, { status: 400 });

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
            is_onboarded: true, // Bypass onboarding to let them use the app immediately
            avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=Fixed`,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Successfully injected profile! Go back and refresh." });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
