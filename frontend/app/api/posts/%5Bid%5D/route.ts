import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

// DELETE /api/posts/[id]
// Centralized, authorized post deletion
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const postId = params.id;

        // 1. Verify Ownership on Server Side
        const { data: post, error: fetchError } = await supabaseAdmin
            .from('posts')
            .select('user_id, file_urls')
            .eq('id', postId)
            .single();

        if (fetchError || !post) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        if (post.user_id !== userId) {
            return NextResponse.json({ error: 'Forbidden: You do not own this post' }, { status: 403 });
        }

        // 2. Perform Deletion
        const { error: deleteError } = await supabaseAdmin
            .from('posts')
            .delete()
            .eq('id', postId);

        if (deleteError) {
            throw deleteError;
        }

        // 3. Log the action (Audit)
        await supabaseAdmin.from('audit_logs').insert({
            user_id: userId,
            action: 'POST_DELETE',
            metadata: { post_id: postId, file_urls: post.file_urls }
        });

        return NextResponse.json({ success: true, message: 'Post deleted successfully' });

    } catch (error: any) {
        console.error('[Post Delete API] Error:', error);
        return NextResponse.json({ error: 'Deletion failed: ' + error.message }, { status: 500 });
    }
}
