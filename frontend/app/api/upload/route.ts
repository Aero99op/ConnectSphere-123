
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    const session = await auth();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // SECURITY: Validate file size (200MB max server-side — Catbox supports 200MB)
        if (file.size > 200 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Max 200MB.' }, { status: 413 });
        }

        // SECURITY FIX (HIGH-005): Validate file type — MIME-first approach
        const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf'];
        const isAllowedMime = file.type && allowedTypes.some(t => file.type.startsWith(t));
        
        // Extension check is secondary — chunks may not have extensions
        const fileName = (file as any).name || '';
        const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|mp3|wav|ogg|pdf)$/i;
        // If file has a recognizable name with extension, validate it. Otherwise skip.
        const hasExtension = /\.\w+$/.test(fileName);
        const hasAllowedExt = hasExtension ? allowedExtensions.test(fileName) : true;
        
        // Block only if MIME type fails (primary gate)
        if (!isAllowedMime) {
            return NextResponse.json({ error: 'File type not allowed' }, { status: 415 });
        }
        
        // If file has an explicit bad extension, block it too
        if (hasExtension && !hasAllowedExt) {
            return NextResponse.json({ error: 'File extension not allowed' }, { status: 415 });
        }

        const catboxFormData = new FormData();
        catboxFormData.append('reqtype', 'fileupload');
        
        // Use userhash from .env.local if available to link file to specific account
        if (process.env.CATBOX_USER_HASH) {
            catboxFormData.append('userhash', process.env.CATBOX_USER_HASH);
        }

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

