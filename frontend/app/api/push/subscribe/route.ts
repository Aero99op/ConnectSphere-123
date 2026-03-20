import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { endpoint, keys } = body;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
        }

        const userId = session.user.id;

        // Upsert the subscription (matching by endpoint)
        // If the endpoint exists, it just overrides to prevent duplicates
        const { error } = await supabaseAdmin
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                endpoint: endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                created_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });

        if (error) {
            console.error('[Push Subscribe] Error inserting into DB:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Subscribed to Push Notifications' });
    } catch (error) {
        console.error('[Push Subscribe] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
