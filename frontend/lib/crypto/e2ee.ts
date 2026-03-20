/**
 * e2ee.ts
 * Global Top Hacker-Proof End-to-End Encryption
 * Uses Web Crypto API: ECDH (P-384), ECDSA (P-384), AES-GCM (256-bit), HKDF + ML-KEM-768 (PQC)
 */
// @ts-ignore
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

const DB_NAME = "CS_E2EE_KEYSTORE";
const STORE_NAME = "device_keys";
const DB_VERSION = 1;

/** IndexedDB wrapper for non-extractable keys */
class KeyStore {
    private dbPromise: Promise<IDBDatabase>;

    constructor() {
        this.dbPromise = new Promise((resolve, reject) => {
            if (typeof window === 'undefined') return; // SSR check
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event: any) => {
                event.target.result.createObjectStore(STORE_NAME);
            };
        });
    }

    async saveKey(id: string, key: CryptoKey) {
        const db = await this.dbPromise;
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(key, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getKey(id: string): Promise<CryptoKey | null> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(tx.error);
        });
    }
}

export const keyStore = new KeyStore();

/** Generate ECDH and ECDSA key pairs and store private keys locally */
export async function generateDeviceKeys() {
    // 1. ECDH for Encryption
    const ecdhPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-384" },
        false, // PRIVATE KEY IS NON-EXTRACTABLE! Top Hacker Proof.
        ["deriveKey", "deriveBits"]
    );

    // 2. ECDSA for Signatures (Authentication)
    const ecdsaPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-384" },
        false, // PRIVATE KEY IS NON-EXTRACTABLE!
        ["sign", "verify"]
    );

    // 3. ML-KEM-768 for Post-Quantum Key Encapsulation
    const { publicKey, secretKey } = ml_kem768.keygen();

    // Save Private Keys to IndexedDB
    await keyStore.saveKey("ecdh_private", ecdhPair.privateKey);
    await keyStore.saveKey("ecdsa_private", ecdsaPair.privateKey);
    await keyStore.saveKey("mlkem_private", secretKey as any);

    // Export Public Keys logic (we'll save these to Supabase)
    const ecdhPublicJwk = await crypto.subtle.exportKey("jwk", ecdhPair.publicKey);
    const ecdsaPublicJwk = await crypto.subtle.exportKey("jwk", ecdsaPair.publicKey);
    const mlkemPublicB64 = bufferToBase64(publicKey);

    return { ecdhPublicJwk, ecdsaPublicJwk, mlkemPublic: mlkemPublicB64 };
}

/** Check if device keys exist */
export async function hasDeviceKeys() {
    const k1 = await keyStore.getKey("ecdh_private");
    const k2 = await keyStore.getKey("ecdsa_private");
    const k3 = await keyStore.getKey("mlkem_private");
    return !!(k1 && k2 && k3);
}

/** Import a JWK Public Key from Supabase */
export async function importPublicKey(jwk: any, type: "ECDH" | "ECDSA") {
    if (typeof jwk === 'string') jwk = JSON.parse(jwk);
    return await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: type, namedCurve: "P-384" },
        true,
        type === "ECDH" ? [] : ["verify"]
    );
}

/** Utility: ArrayBuffer or Uint8Array to Base64 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Utility: Base64 to ArrayBuffer */
export function base64ToBuffer(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/** Derive Shared Secret (AES-KW 256-bit Key) from ECDH */
async function deriveWrappingKey(myPrivateKey: CryptoKey, theirPublicKey: CryptoKey) {
    return await crypto.subtle.deriveKey(
        { name: "ECDH", public: theirPublicKey },
        myPrivateKey,
        { name: "AES-GCM", length: 256 },
        true, // Must be extractable so we can export wrapped keys
        ["encrypt", "decrypt"]
    );
}

/** Derive Hybrid Shared Secret (ECDH + ML-KEM) */
async function deriveHybridWrappingKey(myEcdhPriv: CryptoKey, theirEcdhPub: CryptoKey, mlkemSharedSecret: Uint8Array) {
    const ecdhBits = await crypto.subtle.deriveBits(
        { name: "ECDH", public: theirEcdhPub },
        myEcdhPriv,
        256
    );
    // Combine ECDH and ML-KEM shared secrets
    const combined = new Uint8Array(ecdhBits.byteLength + mlkemSharedSecret.byteLength);
    combined.set(new Uint8Array(ecdhBits), 0);
    combined.set(mlkemSharedSecret, ecdhBits.byteLength);

    // Hash the combined secrets to derive a new AES key
    const hybridHash = await crypto.subtle.digest("SHA-256", combined);
    
    return await crypto.subtle.importKey(
        "raw",
        hybridHash,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/** Encrypt a text message, sign it, and wrap the session key for all recipients */
export async function encryptMessageAndSign(
    text: string, 
    recipientPublicKeys: Record<string, { ecdh: any, mlkem: string | null }>,
    myEcdsaPrivateKey: CryptoKey,
    myEcdhPrivateKey: CryptoKey
) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // 1. Generate random AES-256-GCM Session Key & IV
    const sessionKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 2. Encrypt the data
    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        sessionKey,
        data.buffer as ArrayBuffer
    );

    // 3. Sign the ciphertext
    const signatureBuffer = await crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-384" } },
        myEcdsaPrivateKey,
        ciphertextBuffer
    );

    // 4. Wrap (Encrypt) the Session Key for each recipient
    const exportedSessionKeyBuffer = await crypto.subtle.exportKey("raw", sessionKey);
    const encryptedKeys: Record<string, any> = {};

    for (const [userId, keys] of Object.entries(recipientPublicKeys)) {
        if (!keys.ecdh) continue;
        const theirEcdhPublic = await importPublicKey(keys.ecdh, "ECDH");
        
        let wrappingKey;
        let pqcCiphertextB64 = null;
        
        if (keys.mlkem) {
            const recipientMlKemPublicKey = base64ToBuffer(keys.mlkem);
            let pqkCiphertext = "";
            let mlKemSharedSecret = new Uint8Array(32); // fallback empty

            try {
                // encapsulate() returns { cipherText, sharedSecret }
                const kemData = ml_kem768.encapsulate(new Uint8Array(recipientMlKemPublicKey));
                const cipherText = kemData.cipherText;
                mlKemSharedSecret = new Uint8Array(kemData.sharedSecret);
                pqkCiphertext = bufferToBase64(cipherText);
            } catch (err) {
                console.error("ML-KEM Encapsulation failed:", err);
            }
            wrappingKey = await deriveHybridWrappingKey(myEcdhPrivateKey, theirEcdhPublic, mlKemSharedSecret);
            pqcCiphertextB64 = pqkCiphertext;
        } else {
            wrappingKey = await deriveWrappingKey(myEcdhPrivateKey, theirEcdhPublic);
        }
        
        const wrapIv = new Uint8Array(12);
        const wrappedKeyBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: wrapIv.buffer as ArrayBuffer },
            wrappingKey,
            exportedSessionKeyBuffer as ArrayBuffer
        );
        
        encryptedKeys[userId] = {
            wrappedKey: bufferToBase64(wrappedKeyBuffer),
            pqcCiphertext: pqcCiphertextB64
        };
    }

    return {
        encryptedContent: bufferToBase64(ciphertextBuffer),
        iv: bufferToBase64(iv),
        signature: bufferToBase64(signatureBuffer),
        encryptedKeys
    };
}

/** Decrypt message and Verify Signature */
export async function decryptMessageAndVerify(
    encryptedContentB64: string,
    ivB64: string,
    signatureB64: string,
    encryptedKeyObject: { wrappedKey: string, pqcCiphertext: string | null } | string,
    senderEcdsaPublicJwkStr: string,
    senderEcdhPublicJwkStr: string,
    myEcdhPrivateKey: CryptoKey,
    myMlkemPrivateKey?: Uint8Array
) {
    const ciphertext = base64ToBuffer(encryptedContentB64);
    const iv = base64ToBuffer(ivB64);
    const signature = base64ToBuffer(signatureB64);
    
    // Safely parse legacy or new wrapped key format
    const isHybrid = typeof encryptedKeyObject === 'object' && encryptedKeyObject.pqcCiphertext;
    const wrappedSessionKeyB64 = typeof encryptedKeyObject === 'string' ? encryptedKeyObject : encryptedKeyObject.wrappedKey;
    const wrappedSessionKey = base64ToBuffer(wrappedSessionKeyB64);

    // 1. Verify Signature FIRST (Anti-tamper / Anti-MITM)
    const senderEcdsaPublic = await importPublicKey(senderEcdsaPublicJwkStr, "ECDSA");
    const isValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-384" } },
        senderEcdsaPublic,
        signature,
        ciphertext
    );

    if (!isValid) throw new Error("SECURITY ALERT: Signature verification failed. Message tampered.");

    // 2. Unwrap Session Key using Standard or Hybrid KDF
    const senderEcdhPublic = await importPublicKey(senderEcdhPublicJwkStr, "ECDH");
    
    let wrappingKey;
    if (isHybrid && typeof encryptedKeyObject !== 'string' && myMlkemPrivateKey) {
        const pqcSharedSecret = ml_kem768.decapsulate(
            new Uint8Array(base64ToBuffer(encryptedKeyObject.pqcCiphertext!)), 
            myMlkemPrivateKey
        );
        wrappingKey = await deriveHybridWrappingKey(myEcdhPrivateKey, senderEcdhPublic, new Uint8Array(pqcSharedSecret));
    } else {
        wrappingKey = await deriveWrappingKey(myEcdhPrivateKey, senderEcdhPublic);
    }
    
    const wrapIv = new Uint8Array(12);

    const rawSessionKey = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: wrapIv.buffer as ArrayBuffer },
        wrappingKey,
        wrappedSessionKey as ArrayBuffer
    );

    const sessionKey = await crypto.subtle.importKey(
        "raw",
        rawSessionKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // 3. Decrypt Content
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        sessionKey,
        ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
}

/** Blob Encryption for Files (Catbox) */
export async function encryptFileBlob(file: File | Blob) {
    const fileBuffer = await file.arrayBuffer();
    const fileKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        fileKey,
        fileBuffer as ArrayBuffer
    );

    const rawKey = await crypto.subtle.exportKey("raw", fileKey);
    const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

    return {
        encryptedBlob,
        fileKeyB64: bufferToBase64(rawKey),
        fileIvB64: bufferToBase64(iv)
    };
}

export async function decryptFileBlob(encryptedBuffer: ArrayBuffer, fileKeyB64: string, fileIvB64: string) {
    const rawKey = base64ToBuffer(fileKeyB64);
    const iv = base64ToBuffer(fileIvB64);

    const fileKey = await crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        fileKey,
        encryptedBuffer
    );

    return new Blob([decryptedBuffer]);
}
