import { NextResponse } from 'next/server';

export const runtime = 'edge';

// SECURITY FIX (CRIT-001): This endpoint previously exposed private VAPID keys
// to the public internet with zero authentication. 
// Now completely disabled in production — keys should be generated locally and 
// added to .env manually. This route returns a safe instructional message.

export async function GET() {
    // In development, still allow key generation for convenience
    if (process.env.NODE_ENV === 'development') {
        try {
            const keyPair = await crypto.subtle.generateKey(
                { name: 'ECDSA', namedCurve: 'P-256' },
                true,
                ['sign', 'verify']
            );

            const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
            const publicKeyB64Url = arrayBufferToBase64Url(publicKeyRaw);
            const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
            const privateKeyB64Url = privateKeyJwk.d;

            return NextResponse.json({
                message: '⚠️ DEV ONLY — Add these to your .env file!',
                NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKeyB64Url,
                VAPID_PRIVATE_KEY: privateKeyB64Url,
            });
        } catch (error: any) {
            return NextResponse.json({ error: 'Key generation failed' }, { status: 500 });
        }
    }

    // Production: Return safe instructional message — no key material exposed
    return NextResponse.json({
        message: 'VAPID keys must be generated locally. Run: node -e "const c=require(\'crypto\');const k=c.generateKeyPairSync(\'ec\',{namedCurve:\'prime256v1\'});console.log(k)"',
        hint: 'Generate keys locally and add to Cloudflare Pages environment variables.'
    });
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
