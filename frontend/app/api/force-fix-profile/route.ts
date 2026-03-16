import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, emailToUUID } from '@/lib/auth';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        // SECURITY: Require authentication
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const email = session.user.email;
        if (!email) {
            return NextResponse.json({ error: 'No email in session' }, { status: 400 });
        }

        // SECURITY FIX (HIGH-003): Compute ID from email — never accept from query params
        const id = await emailToUUID(email);

        const adminSupabase = createAdminSupabaseClient();

        // Check if exists (try salted first, then legacy)
        let { data: existing } = await adminSupabase.from('profiles').select('id').eq('id', id).maybeSingle();
        
        if (!existing) {
            // Try legacy unsalted UUID
            const legacyId = await emailToUUID(email, "");
            const { data: legacyExisting } = await adminSupabase.from('profiles').select('id').eq('id', legacyId).maybeSingle();
            if (legacyExisting) {
                return NextResponse.json({ message: "Profile already exists (legacy), no fix needed!" });
            }
        } else {
            return NextResponse.json({ message: "Profile already exists, no fix needed!" });
        }

        // Force insert with computed ID
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
