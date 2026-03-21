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

        // Block obviously malicious executable files to keep the app safe.
        const fileName = (file as any).name || '';
        const maliciousExtensions = /\.(exe|bat|sh|cmd|ps1|vbs|js|php|py|pl|rb|cgi|dll|scr|com|pif)$/i;
        
        if (fileName && maliciousExtensions.test(fileName)) {
            console.error(`[Catbox] Malicious file blocked: Name="${fileName}", Type="${file.type}", Size=${file.size}`);
            return NextResponse.json({ error: `Security risk: This file type is not allowed.` }, { status: 415 });
        }

        // Bhenchod sab baaki chalega. No other restrictions.
        console.log(`[Catbox] Uploading file: Name="${fileName}", Type="${file.type || 'unknown'}", Size=${file.size}`);


        // Re-construct FormData for Catbox
        const catboxFormData = new FormData();
        catboxFormData.append('reqtype', 'fileupload');
        
        // Use userhash from .env.local if available to link file to specific account
        if (process.env.CATBOX_USER_HASH) {
            catboxFormData.append('userhash', process.env.CATBOX_USER_HASH);
        }
        
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
