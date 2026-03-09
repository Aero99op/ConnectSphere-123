import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        // SECURITY: Require authentication
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('fileToUpload') as File || formData.get('file') as File;

        // SECURITY: Validate file exists
        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // SECURITY: Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Max 50MB.' }, { status: 413 });
        }

        // SECURITY: Validate file type (HIGH-003 FIX)
        const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf'];
        const isAllowed = allowedTypes.some(t => file.type.startsWith(t));
        if (!isAllowed && file.type) {
            return NextResponse.json({ error: 'File type not allowed' }, { status: 415 });
        }

        // Re-construct FormData for Catbox
        const catboxFormData = new FormData();
        catboxFormData.append('reqtype', 'fileupload');
        catboxFormData.append('fileToUpload', file, (file as any).name || 'upload.bin');

        const response = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: catboxFormData,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Catbox Upload Failed: ${response.statusText}` },
                { status: response.status }
            );
        }

        const url = await response.text();
        return NextResponse.json({ url });
    } catch (error: any) {
        console.error("Error in catbox proxy:", error);
        return NextResponse.json(
            { error: "Upload failed. Please try again." },
            { status: 500 }
        );
    }
}
