"use server";

import { createServerSupabase } from './supabase';

/**
 * Fetch a profile by username securely on the server.
 * This prevents the client from making direct PostgREST calls 
 * and hides the internal UUID/Email mapping.
 */
export async function getProfileByUsername(username: string) {
    if (!username) return { data: null, error: "Username is required" };

    const supabase = createServerSupabase();

    // Use the safe view or filter manually to ensure no leaked PII
    // We already Revoked SELECT on the raw table for anon, so this is safe.
    // 🔱 Smart lookup: Check if input is a UUID or a username
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(username);
    const query = supabase.from('profiles').select(`
        id, 
        username, 
        full_name, 
        avatar_url, 
        bio, 
        role, 
        karma_points, 
        department, 
        assigned_area, 
        country, 
        is_onboarded
    `);

    if (isUUID) {
        query.eq('id', username);
    } else {
        query.eq('username', username);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        console.error(`[getProfileByUsername] Error for ${username}:`, error);
        return { data: null, error: "Failed to fetch profile" };
    }

    return { data, error: null };
}

/**
 * Fetch stats for a user by ID.
 */
export async function getUserStats(userId: string) {
    if (!userId) return { data: null };

    const supabase = createServerSupabase();

    const [postsCount, quixCount, followersCount, followingCount] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('quix').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
    ]);

    return {
        data: {
            posts: postsCount.count || 0,
            quix: quixCount.count || 0,
            followers: followersCount.count || 0,
            following: followingCount.count || 0
        }
    };
}
