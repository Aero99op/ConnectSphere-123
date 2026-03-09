import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

// DELETE /api/quix/[id]
// Secure deletion for Quix videos
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
        const quixId = params.id;

        // 1. Verify Ownership on Server Side
        const { data: quix, error: fetchError } = await supabaseAdmin
            .from('quix')
            .select('user_id, video_url')
            .eq('id', quixId)
            .single();

        if (fetchError || !quix) {
            return NextResponse.json({ error: 'Quix not found' }, { status: 404 });
        }

        if (quix.user_id !== userId) {
            return NextResponse.json({ error: 'Forbidden: You do not own this Quix' }, { status: 403 });
        }

        // 2. Perform Deletion
        // Cascade handles likes/bookmarks/reposts
        const { error: deleteError } = await supabaseAdmin
            .from('quix')
            .delete()
            .eq('id', quixId);

        if (deleteError) {
            throw deleteError;
        }

        // 3. Log the action (Audit)
        await supabaseAdmin.from('audit_logs').insert({
            user_id: userId,
            action: 'QUIX_DELETE',
            metadata: { quix_id: quixId, video_url: quix.video_url }
        });

        return NextResponse.json({ success: true, message: 'Quix deleted successfully' });

    } catch (error: any) {
        console.error('[Quix Delete API] Error:', error);
        return NextResponse.json({ error: 'Deletion failed. Please try again.' }, { status: 500 });
    }
}
