import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/actions/supabase';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';
        const type = searchParams.get('type') || 'all'; // 'users', 'posts', or 'all'

        const supabase = createServerSupabase();

        let users: any[] = [];
        let posts: any[] = [];

        if (type === 'users' || type === 'all') {
            if (query.trim()) {
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
            if (query.trim()) {
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
