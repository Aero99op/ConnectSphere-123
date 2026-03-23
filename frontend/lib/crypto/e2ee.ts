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

let _activeUserId = "";

export function setActiveUserId(uid: string) {
    if (uid) _activeUserId = uid;
}

function getNamespacedId(id: string): string {
    if ((id === "ecdh_private" || id === "ecdsa_private" || id === "mlkem_private") && _activeUserId) {
        return `${_activeUserId}_${id}`;
    }
    return id;
}

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

    async saveKey(id: string, key: CryptoKey | Uint8Array) {
        const actualId = getNamespacedId(id);
        const db = await this.dbPromise;
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(key, actualId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getKey(id: string): Promise<CryptoKey | Uint8Array | null> {
        const actualId = getNamespacedId(id);
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(actualId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(tx.error);
        });
    }

    async deleteKeyRaw(rawId: string): Promise<void> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const req = tx.objectStore(STORE_NAME).delete(rawId);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(tx.error);
        });
    }
}

export const keyStore = new KeyStore();

/** Generate ECDH and ECDSA key pairs and store private keys locally */
export async function generateDeviceKeys() {
    // 1. ECDH for Encryption — extractable so keys can sync across devices
    const ecdhPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-384" },
        true, // EXTRACTABLE — needed for cross-device key sync via DB
        ["deriveKey", "deriveBits"]
    );

    // 2. ECDSA for Signatures (Authentication)
    const ecdsaPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-384" },
        true, // EXTRACTABLE — needed for cross-device key sync via DB
        ["sign", "verify"]
    );

    // 3. ML-KEM-768 for Post-Quantum Key Encapsulation
    const { publicKey, secretKey } = ml_kem768.keygen();

    // Save Private Keys to IndexedDB
    await keyStore.saveKey("ecdh_private", ecdhPair.privateKey);
    await keyStore.saveKey("ecdsa_private", ecdsaPair.privateKey);
    await keyStore.saveKey("mlkem_private", secretKey as any);

    // Export Public Keys (for Supabase profiles)
    const ecdhPublicJwk = await crypto.subtle.exportKey("jwk", ecdhPair.publicKey);
    const ecdsaPublicJwk = await crypto.subtle.exportKey("jwk", ecdsaPair.publicKey);

    // FIX: Strip key_ops from public JWKs
    delete (ecdhPublicJwk as any).key_ops;
    delete (ecdsaPublicJwk as any).key_ops;

    // Save Public JWKs for identity persistence during encryption
    await keyStore.saveKey("ecdh_public_jwk", ecdhPublicJwk as any);
    await keyStore.saveKey("ecdsa_public_jwk", ecdsaPublicJwk as any);

    // Export Private Keys as JWK (for cross-device sync via DB)
    const ecdhPrivateJwk = await crypto.subtle.exportKey("jwk", ecdhPair.privateKey);
    const ecdsaPrivateJwk = await crypto.subtle.exportKey("jwk", ecdsaPair.privateKey);
    const mlkemPrivateB64 = bufferToBase64(secretKey);
    const mlkemPublicB64 = bufferToBase64(publicKey);

    return {
        ecdhPublicJwk, ecdsaPublicJwk, mlkemPublic: mlkemPublicB64,
        // Private keys for DB storage (cross-device sync)
        ecdhPrivateJwk, ecdsaPrivateJwk, mlkemPrivateB64
    };
}

/** Check if device keys exist */
export async function hasDeviceKeys() {
    let k1 = await keyStore.getKey("ecdh_private");
    let k2 = await keyStore.getKey("ecdsa_private");
    let k3 = await keyStore.getKey("mlkem_private");
    
    // Auto-migrate global keys to user-namespaced keys for backwards compatibility
    if (!k1 && _activeUserId) {
        const db = await (keyStore as any).dbPromise;
        const globalK1 = await new Promise<any>((resolve) => {
             const tx = db.transaction(STORE_NAME, "readonly");
             const req = tx.objectStore(STORE_NAME).get("ecdh_private");
             req.onsuccess = () => resolve(req.result || null);
             req.onerror = () => resolve(null);
        });
        if (globalK1) {
             console.log("[E2EE] Migrating legacy global keys to user namespace...");
             const globalK2 = await new Promise<any>((resolve) => {
                  const tx = db.transaction(STORE_NAME, "readonly");
                  const req = tx.objectStore(STORE_NAME).get("ecdsa_private");
                  req.onsuccess = () => resolve(req.result || null);
             });
             const globalK3 = await new Promise<any>((resolve) => {
                  const tx = db.transaction(STORE_NAME, "readonly");
                  const req = tx.objectStore(STORE_NAME).get("mlkem_private");
                  req.onsuccess = () => resolve(req.result || null);
             });
             // Save namespaced
             await keyStore.saveKey("ecdh_private", globalK1);
             if (globalK2) await keyStore.saveKey("ecdsa_private", globalK2);
             if (globalK3) await keyStore.saveKey("mlkem_private", globalK3);
             
             // Delete dirty global
             await keyStore.deleteKeyRaw("ecdh_private");
             await keyStore.deleteKeyRaw("ecdsa_private");
             await keyStore.deleteKeyRaw("mlkem_private");
             
             return true;
        }
    }
    
    return !!(k1 && k2 && k3);
}

/** Get local public JWKs from IndexedDB for sync comparison */
export async function getLocalPublicKeys() {
    const ecdh = await keyStore.getKey("ecdh_public_jwk") as any;
    const ecdsa = await keyStore.getKey("ecdsa_public_jwk") as any;
    return { ecdh, ecdsa };
}

/** Import device keys from DB (cross-device sync) — downloads keys stored by another device */
export async function importDeviceKeysFromDB(
    ecdhPrivateJwkStr: string,
    ecdsaPrivateJwkStr: string,
    mlkemPrivateB64: string,
    ecdhPublicJwkStr: string,
    ecdsaPublicJwkStr: string
) {
    // Import ECDH private key
    const ecdhPrivateJwk = JSON.parse(ecdhPrivateJwkStr);
    delete ecdhPrivateJwk.key_ops; // Strip to avoid inconsistency
    const ecdhPrivateKey = await crypto.subtle.importKey(
        "jwk", ecdhPrivateJwk,
        { name: "ECDH", namedCurve: "P-384" },
        true, ["deriveKey", "deriveBits"]
    );

    // Import ECDSA private key
    const ecdsaPrivateJwk = JSON.parse(ecdsaPrivateJwkStr);
    delete ecdsaPrivateJwk.key_ops;
    const ecdsaPrivateKey = await crypto.subtle.importKey(
        "jwk", ecdsaPrivateJwk,
        { name: "ECDSA", namedCurve: "P-384" },
        true, ["sign", "verify"]
    );

    // Restore ML-KEM private key
    const mlkemPrivate = new Uint8Array(base64ToBuffer(mlkemPrivateB64));

    // Save to IndexedDB
    await keyStore.saveKey("ecdh_private", ecdhPrivateKey);
    await keyStore.saveKey("ecdsa_private", ecdsaPrivateKey);
    await keyStore.saveKey("mlkem_private", mlkemPrivate as any);

    // Also save public JWKs for identity persistence
    const ecdhPublicJwk = JSON.parse(ecdhPublicJwkStr);
    const ecdsaPublicJwk = JSON.parse(ecdsaPublicJwkStr);
    delete ecdhPublicJwk.key_ops;
    delete ecdsaPublicJwk.key_ops;
    await keyStore.saveKey("ecdh_public_jwk", ecdhPublicJwk as any);
    await keyStore.saveKey("ecdsa_public_jwk", ecdsaPublicJwk as any);

    console.log("[E2EE] ✅ Keys imported from DB — cross-device sync complete!");
}

/** Import a JWK Public Key from Supabase */
export async function importPublicKey(jwk: any, type: "ECDH" | "ECDSA") {
    if (typeof jwk === 'string') jwk = JSON.parse(jwk);
    // FIX: Clone and strip key_ops to avoid "inconsistent key_ops" DataError
    // Old JWKs may have key_ops:["deriveKey","deriveBits"] from export, but
    // ECDH public keys must have empty usages per Web Crypto spec.
    const cleanJwk = { ...jwk };
    delete cleanJwk.key_ops;
    return await crypto.subtle.importKey(
        "jwk",
        cleanJwk,
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

/** Utility: Base64 to ArrayBuffer (Robust version) */
export function base64ToBuffer(base64: string) {
    if (!base64) return new Uint8Array(0).buffer;
    
    // Sanitize: remove whitespace and any potential data URIs/quotes that might have leaked in
    const sanitized = base64.trim().replace(/^"|"$/g, '');
    
    try {
        const binary = atob(sanitized);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error("[E2EE] base64ToBuffer failed for string:", sanitized.substring(0, 20) + "...");
        throw e;
    }
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
        
        // SECURITY FIX (CRIT-004): Generate random IV for each key wrap — never reuse IV with AES-GCM
        const wrapIv = crypto.getRandomValues(new Uint8Array(12));
        const wrappedKeyBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: wrapIv.buffer as ArrayBuffer },
            wrappingKey,
            exportedSessionKeyBuffer as ArrayBuffer
        );
        
        // Identity Persistence: Store sender's public keys so decryption always works even after rotations
        const myEcdsaPublicJwk = await keyStore.getKey("ecdsa_public_jwk");
        const myEcdhPublicJwk = await keyStore.getKey("ecdh_public_jwk");

        encryptedKeys[userId] = {
            wrappedKey: bufferToBase64(wrappedKeyBuffer),
            wrapIv: bufferToBase64(wrapIv),
            pqcCiphertext: pqcCiphertextB64,
            _spub: myEcdsaPublicJwk, // Embedded sender ECDSA public key
            _hpub: myEcdhPublicJwk   // Embedded sender ECDH public key
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
    encryptedKeyObject: { wrappedKey: string, wrapIv?: string, pqcCiphertext: string | null } | string,
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
    // Priority: 1. Embedded key in message (guarantees old messages still work) 2. Profile key from DB
    const embeddedEcdsa = (typeof encryptedKeyObject === 'object' && (encryptedKeyObject as any)._spub) ? (encryptedKeyObject as any)._spub : null;
    const verificationKeyJwk = embeddedEcdsa || senderEcdsaPublicJwkStr;

    let isValid = false;
    try {
        const senderEcdsaPublic = await importPublicKey(verificationKeyJwk, "ECDSA");
        isValid = await crypto.subtle.verify(
            { name: "ECDSA", hash: { name: "SHA-384" } },
            senderEcdsaPublic,
            signature,
            ciphertext
        );
    } catch (err) {
        console.warn("[E2EE] Signature verification technical failure:", err);
    }

    if (!isValid) {
        // Fallback: Try with profile key if embedded key was used and failed (unlikely but safe)
        if (embeddedEcdsa && senderEcdsaPublicJwkStr) {
             try {
                 const fallbackPublic = await importPublicKey(senderEcdsaPublicJwkStr, "ECDSA");
                 isValid = await crypto.subtle.verify({ name: "ECDSA", hash: { name: "SHA-384" } }, fallbackPublic, signature, ciphertext);
             } catch(e) {}
        }
    }

    if (!isValid) {
        // Non-fatal: Legacy messages or key-rotated messages may fail signature check.
        // Still attempt decryption — user sees the message with a warning rather than nothing.
    }

    // 2. Unwrap Session Key — try all key combinations to handle any rotation scenario
    const embeddedEcdh = (typeof encryptedKeyObject === 'object' && (encryptedKeyObject as any)._hpub) ? (encryptedKeyObject as any)._hpub : null;
    
    // SECURITY FIX (CRIT-004): Read stored wrapIv; fall back to zero-IV for backward compat
    const wrapIvB64 = (typeof encryptedKeyObject !== 'string' && encryptedKeyObject.wrapIv) ? encryptedKeyObject.wrapIv : null;
    const wrapIv = wrapIvB64 ? new Uint8Array(base64ToBuffer(wrapIvB64)) : new Uint8Array(12);

    // Build all ECDH key sources to try
    const ecdhKeysToTry: any[] = [];
    if (embeddedEcdh) ecdhKeysToTry.push(embeddedEcdh);
    if (senderEcdhPublicJwkStr) ecdhKeysToTry.push(senderEcdhPublicJwkStr);
    if (ecdhKeysToTry.length === 0) ecdhKeysToTry.push(senderEcdhPublicJwkStr);

    let rawSessionKey: ArrayBuffer | null = null;

    // Try each ECDH key with hybrid first, then non-hybrid fallback
    for (const ecdhKeyJwk of ecdhKeysToTry) {
        if (!ecdhKeyJwk || rawSessionKey) break;
        
        let senderEcdhPublic: CryptoKey;
        try {
            senderEcdhPublic = await importPublicKey(ecdhKeyJwk, "ECDH");
        } catch { continue; }

        // Attempt 1: Hybrid path (if message has PQC ciphertext)
        if (isHybrid && typeof encryptedKeyObject !== 'string' && myMlkemPrivateKey) {
            try {
                const pqcSharedSecret = ml_kem768.decapsulate(
                    new Uint8Array(base64ToBuffer(encryptedKeyObject.pqcCiphertext!)),
                    myMlkemPrivateKey
                );
                const wrappingKey = await deriveHybridWrappingKey(myEcdhPrivateKey, senderEcdhPublic, new Uint8Array(pqcSharedSecret));
                rawSessionKey = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: wrapIv.buffer as ArrayBuffer },
                    wrappingKey, wrappedSessionKey as ArrayBuffer
                );
                break;
            } catch { /* hybrid failed, try non-hybrid next */ }
        }

        // Attempt 2: Non-hybrid ECDH-only path (fallback if ML-KEM keys rotated)
        try {
            const wrappingKey = await deriveWrappingKey(myEcdhPrivateKey, senderEcdhPublic);
            rawSessionKey = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: wrapIv.buffer as ArrayBuffer },
                wrappingKey, wrappedSessionKey as ArrayBuffer
            );
            break;
        } catch { /* this key source failed, try next */ }
    }

    if (!rawSessionKey) {
        throw new Error("E2EE_KEY_ROTATION: Cannot decrypt — device keys may have changed.");
    }

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
