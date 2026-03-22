import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateVapidHeader } from '@/lib/push/vapid';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        // SECURITY FIX (CRIT-002): Require authentication before allowing push triggers
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { recipientId, type, title, body: notificationBody, actorName, url } = body;

        if (!recipientId) {
            return NextResponse.json({ error: 'Missing recipientId' }, { status: 400 });
        }

        // Fetch user's push subscriptions
        const { data: subscriptions, error } = await supabaseAdmin
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', recipientId);

        if (error || !subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ success: true, message: 'No active subscriptions' });
        }

        // To keep this 100% Edge safe and avoid complex Web Crypto payload encryption,
        // we send a "Payload-less" push notification. The SW will wake up and fetch
        // the unread notifications automatically!
        
        let successCount = 0;
        let failCount = 0;

        for (const sub of subscriptions) {
            try {
                const endpointUrl = new URL(sub.endpoint);
                const audience = `${endpointUrl.protocol}//${endpointUrl.hostname}`;
                
                // Subject should ideally be an email or URL for the push service to contact us
                const subject = 'mailto:admin@connectsphere.com'; 

                // Generate VAPID auth header using pure Web Crypto (via jose)
                const vapidHeaders = await generateVapidHeader(audience, subject);
                
                const response = await fetch(sub.endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': vapidHeaders,
                        'TTL': '86400', // 1 day
                        // Standard Content-Length: 0 for payload-less
                        'Content-Length': '0' 
                    }
                });

                if (response.ok) {
                    successCount++;
                } else if (response.status === 410 || response.status === 404) {
                    // Subscription expired or no longer valid
                    await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
                    failCount++;
                } else {
                    console.error(`[Push Trigger] Failed for ${sub.endpoint} with status ${response.status}`);
                    failCount++;
                }
            } catch (err) {
                console.error('[Push Trigger] Fetch error:', err);
                failCount++;
            }
        }

        return NextResponse.json({ success: true, sent: successCount, failed: failCount });
    } catch (error) {
        console.error('[Push Trigger] Global Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
