import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@/auth';

export const runtime = 'edge';

// Service Worker calls this to decide what to show after waking up from an empty push heartbeat.
// Important: the user is authenticated via standard Next.js auth cookie!
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ title: 'New Activity', body: 'Open ConnectSphere to see updates.', url: '/' });
        }
        
        const userId = session.user.id;

        // 1. Check for unread messages first
        const { data: unreadMsg } = await supabaseAdmin
            .from('messages')
            .select(`
                id,
                content,
                conversation_id,
                is_read,
                sender:profiles!sender_id(username, full_name, avatar_url)
            `)
            .eq('is_read', false)
            .neq('sender_id', userId)
            .contains('conversation_id', '-') // Assuming conversation_id exists
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (unreadMsg) {
            const sender: any = Array.isArray(unreadMsg.sender) ? unreadMsg.sender[0] : unreadMsg.sender;
            const senderName = sender?.full_name || sender?.username || 'Someone';
            return NextResponse.json({
                title: `New message from ${senderName}`,
                body: "Open chat to read the secure message.", // Body hidden due to E2EE
                icon: sender?.avatar_url || '/logo.svg',
                url: `/chat?id=${unreadMsg.conversation_id}`
            });
        }

        // 2. Check for notifications (likes, followers)
        const { data: notification } = await supabaseAdmin
            .from('notifications')
            .select(`
                *,
                actor:profiles!actor_id(username, full_name, avatar_url)
            `)
            .eq('user_id', userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (notification) {
            const actor: any = Array.isArray(notification.actor) ? notification.actor[0] : notification.actor;
            const actorName = actor?.full_name || actor?.username || 'Someone';
            let action = "interacted with you";
            let url = "/notifications";
            
            if (notification.type === 'like') action = "liked your post";
            if (notification.type === 'comment') action = "commented on your post";
            if (notification.type === 'follow') {
                action = "started following you";
                url = `/profile/${actor?.username}`;
            }

            return NextResponse.json({
                title: `${actorName} ${action}`,
                body: "Tap to view on ConnectSphere.",
                icon: actor?.avatar_url || '/logo.svg',
                url: url
            });
        }

        // Fallback
        return NextResponse.json({
            title: 'ConnectSphere',
            body: 'You have new unseen activity!',
            url: '/'
        });

    } catch (error) {
        console.error('[Latest Push] Error:', error);
        return NextResponse.json({ title: 'ConnectSphere', body: 'New activity!', url: '/' });
    }
}
