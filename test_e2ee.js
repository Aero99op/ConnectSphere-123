import crypto from 'crypto';

function bufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    if (!base64) return new Uint8Array(0).buffer;
    const sanitized = base64.trim().replace(/^"|"$/g, '');
    const binary = atob(sanitized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function test() {
    // mock a wrapping key
    const webcrypto = crypto.webcrypto;
    const wrappingKey = await webcrypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    
    const sessionKey = await webcrypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
    );
    const exportedSessionKeyBuffer = await webcrypto.subtle.exportKey("raw", sessionKey);
    
    // Encrypt
    const wrapIv = webcrypto.getRandomValues(new Uint8Array(12));
    const wrappedKeyBuffer = await webcrypto.subtle.encrypt(
        { name: "AES-GCM", iv: wrapIv },
        wrappingKey,
        exportedSessionKeyBuffer
    );
    
    // Store in obj
    const encryptedKeyObject = {
        wrappedKey: bufferToBase64(wrappedKeyBuffer),
        wrapIv: bufferToBase64(wrapIv),
        pqcCiphertext: null
    };
    
    console.log("Obj", encryptedKeyObject);
    
    // Decrypt
    const wrapIvB64 = (typeof encryptedKeyObject !== 'string' && encryptedKeyObject.wrapIv) ? encryptedKeyObject.wrapIv : null;
    const decWrapIv = wrapIvB64 ? new Uint8Array(base64ToBuffer(wrapIvB64)) : new Uint8Array(12);
    
    const wrappedSessionKeyB64 = typeof encryptedKeyObject === 'string' ? encryptedKeyObject : encryptedKeyObject.wrappedKey;
    const wrappedSessionKey = base64ToBuffer(wrappedSessionKeyB64);
    
    try {
        const rawSessionKey = await webcrypto.subtle.decrypt(
            { name: "AES-GCM", iv: decWrapIv.buffer },
            wrappingKey,
            wrappedSessionKey
        );
        console.log("Success! Extracted len:", rawSessionKey.byteLength);
    } catch (e) {
        console.error("Failed!", e);
    }
}

test();
