import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Helper to encode Uint8Array to Base64Url
function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function GET() {
  try {
    // Generate a P-256 ECDSA key pair
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    // Export public key in RAW format (65 bytes)
    const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyB64Url = arrayBufferToBase64Url(publicKeyRaw);

    // Export private key in JWK format and extract the 'd' parameter
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const privateKeyB64Url = privateKeyJwk.d; // The integer scalar

    return NextResponse.json({
      message: 'Add these to your .env file!',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKeyB64Url,
      VAPID_PRIVATE_KEY: privateKeyB64Url,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
