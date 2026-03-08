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

        // 1. Private Notifications: private-notifications-{userId}
        if (channel_name === `private-notifications-${userId}`) {
            // Authorized automatically for owner (FIXES FINDING-003)
        }
        // 2. User Calls: private-call-{userId}
        else if (channel_name === `private-call-${userId}`) {
            // Authorized for the person receiving the calls
        }
        // 3. WebRTC Signaling: private-webrtc-{roomId}
        else if (channel_name.startsWith('private-webrtc-')) {
            const roomId = channel_name.replace('private-webrtc-', '');
            // Rule: User must be either the caller or being called (derived from roomId)
            // For now, allow if the user is authenticated, but better to check active calls table.
        }
        // 4. Chat Channels: private-chat-{conversationId}
        else if (channel_name.startsWith('private-chat-')) {
            const conversationId = channel_name.replace('private-chat-', '');
            // Verify if user is a participant
            const { data: participant, error } = await supabaseAdmin
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .eq('user_id', userId)
                .maybeSingle();

            if (error || !participant) {
                return NextResponse.json({ error: 'Forbidden: Not a participant' }, { status: 403 });
            }
        }
        // 5. Admin/Official Only: private-reports-updates
        else if (channel_name === 'private-reports-updates') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (!profile || (profile.role !== 'official' && profile.role !== 'admin')) {
                return NextResponse.json({ error: 'Forbidden: Officials only' }, { status: 403 });
            }
        }
        // 6. Sidebar Updates: private-sidebar-{userId}
        else if (channel_name === `private-sidebar-${userId}`) {
            // Authorized for the owner — used for real-time chat sidebar updates
        }
        // 7. User Profile Sync & Social Data: private-profiles-{userId}, private-follows-{userId}
        else if (channel_name === `private-profiles-${userId}` || channel_name === `private-follows-${userId}`) {
            // Authorized for the owner of the data
        }
        // 7. Content Alerts: private-post-{postId}, private-story-{storyId}
        else if (channel_name.startsWith('private-post-') || channel_name.startsWith('private-story-')) {
            // Authorized for any authenticated user (Visibility is handled by DB RLS)
        }
        // 8. Group Calls: private-group-call-{roomId}
        else if (channel_name.startsWith('private-group-call-')) {
            // Authorized for authenticated users 
        }
        else {
            // Reject everything else that doesn't follow private naming or isn't listed
            return NextResponse.json({ error: 'Forbidden: Channel not authorized' }, { status: 403 });
        }

        const server = getApinatorServer();
        const authResult = await server.authenticateChannel(socket_id, channel_name);

        return NextResponse.json(authResult);
    } catch (error) {
        console.error('[Apinator Auth] Error:', error);
        return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
    }
}
