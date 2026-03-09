import { NextRequest, NextResponse } from 'next/server';
import { getApinatorServer } from '@/lib/apinator-server';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

// POST /api/apinator/trigger
// Trigger an event on an Apinator channel from the server side
// SECURITY: Channel ownership validation to prevent injection attacks
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized: User must be logged in' }, { status: 401 });
        }

        const body = await req.json();
        const { channel, event, data } = body;

        if (!channel || !event) {
            return NextResponse.json({ error: 'Missing channel or event' }, { status: 400 });
        }

        const userId = session.user.id;

        // --- SECURITY: Channel Authorization Before Trigger ---

        // 1. Chat channels: STRICT — user must be a conversation participant
        if (channel.startsWith('private-chat-')) {
            const conversationId = channel.replace('private-chat-', '');

            // Check group participants
            const { data: participant } = await supabaseAdmin
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .eq('user_id', userId)
                .maybeSingle();

            if (!participant) {
                // Check DM conversations
                const { data: dmConvo } = await supabaseAdmin
                    .from('conversations')
                    .select('id')
                    .eq('id', conversationId)
                    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
                    .maybeSingle();

                if (!dmConvo) {
                    return NextResponse.json({ error: 'Forbidden: Not a chat participant' }, { status: 403 });
                }
            }
        }
        // 2. Profile/Follows sync: STRICT — owner only
        else if (channel.startsWith('private-profiles-') || channel.startsWith('private-follows-')) {
            const targetUserId = channel.replace('private-profiles-', '').replace('private-follows-', '');
            if (targetUserId !== userId) {
                return NextResponse.json({ error: 'Forbidden: Not the profile owner' }, { status: 403 });
            }
        }
        // 3. Reports channel: officials/admins only
        else if (channel === 'private-reports-updates') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (!profile || (profile.role !== 'official' && profile.role !== 'admin')) {
                return NextResponse.json({ error: 'Forbidden: Officials only' }, { status: 403 });
            }
        }
        // 4. Push-to-other-user channels (sidebar, call, notifications):
        //    Any authenticated user can trigger (callers push to recipient's channel,
        //    likers push to post owner's notifications, etc.)
        //    Subscription auth already controls who can LISTEN.
        else if (
            channel.startsWith('private-sidebar-') ||
            channel.startsWith('private-call-') ||
            channel.startsWith('private-notifications-') ||
            channel.startsWith('private-webrtc-') ||
            channel.startsWith('private-group-call-') ||
            channel.startsWith('private-post-') ||
            channel.startsWith('private-story-')
        ) {
            // Allowed for any authenticated user
        }
        // 5. Reject unknown channel patterns
        else {
            return NextResponse.json({ error: 'Forbidden: Channel not authorized' }, { status: 403 });
        }

        const server = getApinatorServer();
        await server.trigger({
            channel,
            name: event,
            data: typeof data === 'string' ? data : JSON.stringify(data),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Apinator Trigger] Error:', error);
        return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
    }
}
