import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/auth';
import { auth } from '@/auth';

export const runtime = 'edge'; // Because Cloudflare Pages

// SECURITY FIX (CRIT-003): Both GET and POST now use session.user.id instead of
// accepting arbitrary userId from query params. This prevents IDOR attacks.

export async function GET(req: Request) {
    try {
        // SECURITY: Use session-based auth — never trust client-supplied userId
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        const supabase = createAdminSupabaseClient();
        const { data, error } = await supabase
            .from('profiles')
            .select('send_read_receipts, hide_online_status, ghost_mode_until')
            .eq('id', userId)
            .single();
            
        if (error && error.code !== 'PGRST116') {
            console.error("Supabase GET error:", error);
            // Don't throw if row doesn't exist, we fallback to defaults
        }

        let settings = {
            send_read_receipts: data?.send_read_receipts ?? true,
            hide_online_status: data?.hide_online_status ?? false,
            ghost_mode_until: data?.ghost_mode_until ?? null
        };

        return NextResponse.json(settings);
    } catch (error: any) {
        console.error("GET Chat Settings Error:", error);
        return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        // SECURITY: Use session-based auth — never trust client-supplied userId
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json();
        const { settings } = body;

        if (!settings) {
            return NextResponse.json({ error: "Missing settings payload" }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();
        
        // Update the profiles table with new settings
        const { error } = await supabase
            .from('profiles')
            .update({
                ...(settings.send_read_receipts !== undefined && { send_read_receipts: settings.send_read_receipts }),
                ...(settings.hide_online_status !== undefined && { hide_online_status: settings.hide_online_status }),
                ...(settings.ghost_mode_until !== undefined && { ghost_mode_until: settings.ghost_mode_until })
            })
            .eq('id', userId);

        if (error) {
            console.error("Supabase POST error:", error);
            return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
        }

        // Broadcast if ghost mode modified to immediately update clients via apinator
        if ('hide_online_status' in settings) {
            const host = process.env.APINATOR_HOST;
            const appId = process.env.APINATOR_APP_ID;
            const secret = process.env.APINATOR_SECRET;
            
            if (host && appId && secret) {
                await fetch(`${host}/apps/${appId}/events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${secret}`
                    },
                    body: JSON.stringify({
                        channel: 'public-presence',
                        name: 'user-status',
                        data: JSON.stringify({
                            id: userId,
                            online: !settings.hide_online_status
                        })
                    })
                }).catch(e => console.error("Apinator broadcast error:", e));
            }
        }

        return NextResponse.json({ success: true, settings });
    } catch (error: any) {
        console.error("POST Chat Settings Error:", error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
