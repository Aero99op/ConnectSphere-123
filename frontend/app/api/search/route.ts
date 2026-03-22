import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/actions/supabase';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        // SECURITY FIX (MED-001): Require auth for search to prevent unauthenticated exploration
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const rawQuery = searchParams.get('q') || '';
        const type = searchParams.get('type') || 'all'; // 'users', 'posts', or 'all'

        // SECURITY FIX (HIGH-001): Escape ILIKE special characters to prevent filter injection
        const query = rawQuery.replace(/[\\%_]/g, (char) => `\\${char}`);

        const supabase = createServerSupabase();

        let users: any[] = [];
        let posts: any[] = [];

        if (type === 'users' || type === 'all') {
            if (rawQuery.trim()) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url, bio')
                    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
                    .limit(20);
                if (error) {
                    console.error('Search users error:', error);
                } else {
                    users = data || [];
                }
            } else {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url, bio')
                    .limit(20);
                if (error) {
                    console.error('Fetch users error:', error);
                } else {
                    users = data || [];
                }
            }
        }

        if (type === 'posts' || type === 'all') {
            if (rawQuery.trim()) {
                const { data, error } = await supabase
                    .from('posts')
                    .select('*, profiles(username, full_name, avatar_url)')
                    .or(`caption.ilike.%${query}%,title.ilike.%${query}%`)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (error) {
                    console.error('Search posts error:', error);
                } else {
                    posts = (data || []).map(p => ({
                        ...p,
                        username: (p.profiles as any)?.username || 'User',
                        avatar_url: (p.profiles as any)?.avatar_url || '',
                    }));
                }
            } else {
                const { data, error } = await supabase
                    .from('posts')
                    .select('*, profiles(username, full_name, avatar_url)')
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (error) {
                    console.error('Fetch posts error:', error);
                } else {
                    posts = (data || []).map(p => ({
                        ...p,
                        username: (p.profiles as any)?.username || 'User',
                        avatar_url: (p.profiles as any)?.avatar_url || '',
                    }));
                }
            }
        }

        return NextResponse.json({ users, posts });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: 'Search failed', users: [], posts: [] },
            { status: 500 }
        );
    }
}
