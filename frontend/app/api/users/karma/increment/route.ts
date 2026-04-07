import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@/auth';

export const runtime = 'edge';

// POST /api/users/karma/increment
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Bypass RLS to increment target user's karma
        const { error } = await supabaseAdmin.rpc('increment_karma', { user_id_param: userId });

        if (error) {
            console.error('[Karma Increment Error]', error);
            return NextResponse.json({ error: 'Failed to increment karma' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Karma API Error]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
