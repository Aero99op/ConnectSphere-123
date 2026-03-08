import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Triggers notifications for users mentioned in a text using @username.
 */
export async function triggerMentions(
    supabase: SupabaseClient,
    text: string,
    actorId: string,
    entityId: string,
    type: 'post' | 'quix' | 'comment'
) {
    if (!text) return;

    // 1. Extract usernames using regex
    const mentionRegex = /@(\w+)/g;
    const matches = Array.from(text.matchAll(mentionRegex));
    const usernames = Array.from(new Set(matches.map(m => m[1])));

    if (usernames.length === 0) return;

    try {
        // 2. Lookup recipient IDs for these usernames
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, username')
            .in('username', usernames);

        if (error || !profiles) {
            console.error('[triggerMentions] Error fetching profiles:', error);
            return;
        }

        // 3. Create notifications for each valid mention
        for (const profile of profiles) {
            // Don't notify self
            if (profile.id === actorId) continue;

            const notifData = {
                recipient_id: profile.id,
                actor_id: actorId,
                type: 'mention',
                entity_id: entityId,
                metadata: { source_type: type }
            };

            const { error: notifError } = await supabase
                .from('notifications')
                .insert(notifData);

            if (!notifError) {
                // 4. Trigger Apinator for real-time toast
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: `notifications-${profile.id}`,
                        event: 'notification_ping',
                        data: notifData
                    })
                }).catch(err => console.error('[triggerMentions] Apinator trigger failed:', err));
            }
        }
    } catch (err) {
        console.error('[triggerMentions] Unexpected error:', err);
    }
}

/**
 * Specifically for Story Shares: Notifies the owner of a Quix when it's shared to a story.
 */
export async function notifyStoryShare(
    supabase: SupabaseClient,
    recipientId: string,
    actorId: string,
    quixId: string
) {
    if (recipientId === actorId) return;

    const notifData = {
        recipient_id: recipientId,
        actor_id: actorId,
        type: 'mention', // Using mention type as it's closest, or we could add 'story_share' if schema allowed
        entity_id: quixId,
        metadata: { action: 'story_share', message: 'mentioned your quix in their story' }
    };

    const { error } = await supabase
        .from('notifications')
        .insert(notifData);

    if (!error) {
        fetch('/api/apinator/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: `notifications-${recipientId}`,
                event: 'notification_ping',
                data: notifData
            })
        }).catch(err => console.error('[notifyStoryShare] Apinator trigger failed:', err));
    }
}
