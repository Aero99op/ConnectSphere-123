import { db, type OfflinePost, type OfflineStory } from './db';

export const syncPosts = async (posts: any[]) => {
    try {
        const formattedPosts: OfflinePost[] = posts.map(post => ({
            id: post.id,
            user_id: post.user_id,
            username: post.username,
            avatar_url: post.avatar_url,
            caption: post.caption,
            media_urls: post.media_urls,
            thumbnail_url: post.thumbnail_url,
            media_type: post.media_type,
            likes_count: post.likes_count,
            created_at: post.created_at,
            profiles: post.profiles
        }));

        await db.posts.bulkPut(formattedPosts);
        console.log('[OfflineSync] Posts synced to local DB');
    } catch (error) {
        console.error('[OfflineSync] Failed to sync posts:', error);
    }
};

export const syncStories = async (stories: any[]) => {
    try {
        const formattedStories: OfflineStory[] = stories
            .filter(s => !s.isAddButton)
            .map(story => ({
                id: story.id,
                user_id: story.user_id,
                username: story.username,
                avatar_url: story.avatar_url,
                media_urls: story.media_urls,
                thumbnail_url: story.thumbnail_url,
                media_type: story.media_type,
                expires_at: story.expires_at,
                created_at: story.created_at
            }));

        await db.stories.bulkPut(formattedStories);
        console.log('[OfflineSync] Stories synced to local DB');
    } catch (error) {
        console.error('[OfflineSync] Failed to sync stories:', error);
    }
};

export const getLocalPosts = async () => {
    return await db.posts.orderBy('created_at').reverse().toArray();
};

export const getLocalStories = async () => {
    return await db.stories.where('expires_at').above(new Date().toISOString()).toArray();
};

export const saveLocalProfile = async (id: string, data: any) => {
    await db.profile.put({ id, data });
};

export const getLocalProfile = async (id: string) => {
    const entry = await db.profile.get(id);
    return entry?.data || null;
};
