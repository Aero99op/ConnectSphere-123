import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createServerSupabase } from '@/lib/actions/supabase';

export const runtime = 'edge';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const myHistory = searchParams.get('history'); // if true, fetch all of authenticated user's stories

    const supabase = createServerSupabase();

    if (myHistory === 'true') {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const { data, error } = await supabase
            .from('stories')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
            
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ stories: data || [] });
    }

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const now = new Date().toISOString();
    
    // Fetch only active stories
    const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .gte('expires_at', now)
        .order('created_at', { ascending: true }); // chronological order for viewing

    if (error) {
        console.error("Error fetching stories:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stories: stories || [] });
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { media_url, media_type } = body;

        if (!media_url || !media_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createServerSupabase();

        // Expire in 24 hours exactly
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase.from('stories').insert({
            user_id: session.user.id,
            media_urls: [media_url], // Using correct array schema
            media_type,
            expires_at: expiresAt
        }).select().single();

        if (error) throw error;

        return NextResponse.json({ story: data });
    } catch (error: any) {
        console.error("Story creation error:", error);
        return NextResponse.json({ error: 'Failed to create story' }, { status: 500 });
    }
}
