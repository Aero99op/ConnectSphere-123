import { NextRequest, NextResponse } from 'next/server';
import { getApinatorServer } from '@/lib/apinator-server';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

// POST /api/apinator/auth
// Authenticates private and presence channel subscriptions
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized: User must be logged in' }, { status: 401 });
        }

        const body = await req.json();
        const { socket_id, channel_name } = body;

        if (!socket_id || !channel_name) {
            return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
        }

        const userId = session.user.id;

        // --- Channel Authorization Policies ---

        // 1. Private Notifications: user-specific
        if (channel_name === `private-notifications-${userId}`) {
            // Authorized automatically for owner
        }
        // 2. Chat Channels: chat-{conversationId}
        else if (channel_name.startsWith('chat-')) {
            const conversationId = channel_name.replace('chat-', '');
            // Verify if user is a participant
            const { data: participant, error } = await supabaseAdmin
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .eq('user_id', userId)
                .maybeSingle();

            if (error || !participant) {
                // Check if it's user1/user2 in a direct conversation
                const { data: conv } = await supabaseAdmin
                    .from('conversations')
                    .select('user1_id, user2_id')
                    .eq('id', conversationId)
                    .maybeSingle();

                if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
                    return NextResponse.json({ error: 'Forbidden: Not a participant' }, { status: 403 });
                }
            }
        }
        // 3. Admin/Official Only: reports-updates
        else if (channel_name === 'reports-updates') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (!profile || (profile.role !== 'official' && profile.role !== 'admin')) {
                return NextResponse.json({ error: 'Forbidden: Officials only' }, { status: 403 });
            }
        }

        const server = getApinatorServer();
        const authResult = await server.authenticateChannel(socket_id, channel_name);

        return NextResponse.json(authResult);
    } catch (error) {
        console.error('[Apinator Auth] Error:', error);
        return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
    }
}
