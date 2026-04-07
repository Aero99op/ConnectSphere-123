/**
 * 🇮🇳 ConnectSphere Storage Utility (Hardened V2)
 * Manages all uploads to Catbox.moe with Proxy/Direct switching.
 */


/**
 * Uploads a file to Catbox.moe.
 * Small files (< 20MB) go through the Next.js Proxy for better session control.
 * Large files/chunks SHOULD go direct to avoid serverless timeouts/limits.
 */
export async function uploadToCatbox(file: File | Blob, options: { useProxy?: boolean } = {}): Promise<string> {
    // SECURITY: Cloudflare Free tier limits payload to 25MB! 
    // Anything > 20MB MUST bypass Cloudflare and go directly to Catbox API.
    const useProxy = options.useProxy ?? file.size < 20 * 1024 * 1024;

    if (useProxy) {
        return uploadViaProxy(file);
    } else {
        return uploadDirect(file);
    }
}

async function uploadViaProxy(file: File | Blob): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proxy Upload Failed: ${errorText}`);
    }

    const data = await response.json();
    return data.url;
}

async function uploadDirect(file: File | Blob): Promise<string> {
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    
    // SECURITY FIX (HIGH-007): Use server-only env var — NEXT_PUBLIC_ exposes hash to client JS
    if (process.env.CATBOX_USER_HASH) {
        formData.append("userhash", process.env.CATBOX_USER_HASH);
    }
    
    formData.append("fileToUpload", file);

    const response = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Direct Catbox Upload Failed: ${response.statusText}`);
    }

    return await response.text();
}

/**
 * Helper to log successful uploads for MOSSAD-level auditing.
 */
export async function auditUpload(urls: string[], fileName: string, fileSize: number, supabase: any, userId?: string) {
    try {
        await supabase.from('audit_logs').insert({
            user_id: userId || null,
            action: 'UPLOAD_SUCCESS',
            media_urls: urls,
            metadata: { file_name: fileName, file_size: fileSize }
        });
    } catch (e) {
        console.warn("Audit Log silent failure:", e);
    }
}
