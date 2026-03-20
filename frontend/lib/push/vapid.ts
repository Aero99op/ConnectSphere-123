import { SignJWT, importJWK } from 'jose';

/**
 * Helper to convert Base64URL string to Uint8Array
 */
function base64UrlToUint8Array(base64UrlData: string): Uint8Array {
    const padding = '='.repeat((4 - base64UrlData.length % 4) % 4);
    const base64 = (base64UrlData + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Validates and converts VAPID public/private keys to a CryptoKey
 */
export async function getVapidKey() {
    const publicKeyB64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKeyB64 = process.env.VAPID_PRIVATE_KEY;

    if (!publicKeyB64 || !privateKeyB64) {
        throw new Error('VAPID keys missing in environment variables.');
    }

    // A VAPID public key in base64url is 65 bytes: 1 byte (0x04) + 32 bytes X + 32 bytes Y
    const pubKeyBytes = base64UrlToUint8Array(publicKeyB64);
    if (pubKeyBytes[0] !== 0x04 || pubKeyBytes.length !== 65) {
        throw new Error('Invalid VAPID public key format.');
    }

    // Extract X and Y for JWK format
    const x = btoa(String.fromCharCode(...pubKeyBytes.slice(1, 33))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const y = btoa(String.fromCharCode(...pubKeyBytes.slice(33, 65))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    // Private key is a 32-byte integer
    const d = privateKeyB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        x,
        y,
        d,
        ext: true,
    };

    return await importJWK(jwk, 'ES256');
}

/**
 * Generates the VAPID Authorization header (JWT)
 */
export async function generateVapidHeader(audience: string, subject: string) {
    const key = await getVapidKey();

    const jwt = await new SignJWT({ aud: audience, sub: subject })
        .setProtectedHeader({ typ: 'JWT', alg: 'ES256' })
        .setExpirationTime('12h')
        .sign(key);

    const publicKeyB64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    
    return `vapid t=${jwt}, k=${publicKeyB64}`;
}
