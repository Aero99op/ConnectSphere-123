import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const catboxFormData = new FormData();
        catboxFormData.append('reqtype', 'fileupload');
        catboxFormData.append('fileToUpload', file);

        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: catboxFormData,
        });

        if (!response.ok) {
            throw new Error(`Catbox API Error: ${response.statusText}`);
        }

        const resultUrl = await response.text();
        return NextResponse.json({ url: resultUrl });

    } catch (error: any) {
        console.error('Upload Proxy Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
