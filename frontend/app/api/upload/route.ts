
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

        let resultUrl = '';

        try {
            const response = await fetch('https://catbox.moe/user/api.php', {
                method: 'POST',
                body: catboxFormData,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                }
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.warn(`Catbox Error (${response.status}):`, errorBody);
                throw new Error(`Catbox API Error: ${response.status} - ${errorBody}`);
            }

            resultUrl = (await response.text()).trim();
            
            // Catbox sometimes returns an HTML page instead of URL if there's a firewall
            if (resultUrl.includes('<html') || !resultUrl.startsWith('http')) {
                 throw new Error("Catbox returned invalid URL (possibly WAF/HTML)");
            }

        } catch (catboxError: any) {
            console.warn('⚠️ Catbox upload failed, falling back to Supabase Media Bucket:', catboxError.message);
            
            // --- SUPABASE FALLBACK ---
            // If primary upload fails (e.g. 412 Uploads Paused), juggad straight to Supabase!
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            
            if (!supabaseUrl || !supabaseKey) {
                throw new Error(`Proxy Upload Failed: Both Catbox and Supabase Fallback failed. Catbox err: ${catboxError.message}`);
            }
            
            // Import dynamically for Edge compat instead of require
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
            
            // Generate extremely unique, safe name
            const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
            const uniquePath = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${safeName}`;
            
            const { data, error: upError } = await supabase.storage
                .from('media') // The 'media' public bucket you already have
                .upload(uniquePath, file, {
                    contentType: file.type || 'application/octet-stream',
                    upsert: true
                });
                
            if (upError || !data) {
                console.error("Supabase fallback error:", upError);
                return NextResponse.json({ error: `Upload Failed: Catbox down and Supabase fallback failed (${upError?.message})` }, { status: 500 });
            }
            
            const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(uniquePath);
            resultUrl = publicUrlData.publicUrl;
        }

        return NextResponse.json({ url: resultUrl });

    } catch (error: any) {
        console.error('Upload Proxy Critical Error:', error);
        return NextResponse.json({ error: `Proxy Upload Failed: ${error.message}` }, { status: 500 });
    }
}

