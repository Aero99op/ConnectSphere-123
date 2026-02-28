export const runtime = 'edge';

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const catboxFormData = new FormData();
        catboxFormData.append('reqtype', 'fileupload');

        // Ensure the file has a filename, even if it's a blob
        const filename = (file as any).name || 'upload.bin';
        catboxFormData.append('fileToUpload', file, filename);

        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: catboxFormData,
            headers: {
                // Use proxy to avoid CORS and potentially handle SSL issues at edge
                // These headers are typically set by the browser, but for a server-side proxy,
                // we might want to mimic a browser or use specific headers.
                // The instruction implies updating headers, but the provided snippet only repeats existing ones.
                // Assuming the intent is to keep the existing headers for the proxy request.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Cache-Control': 'no-cache',
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Catbox Error (${response.status}):`, errorBody);
            throw new Error(`Catbox API Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const resultUrl = await response.text();
        return NextResponse.json({ url: resultUrl.trim() });

    } catch (error: any) {
        console.error('Upload Proxy Error:', error);
        return NextResponse.json({ error: `Proxy Upload Failed: ${error.message}` }, { status: 500 });
    }
}

