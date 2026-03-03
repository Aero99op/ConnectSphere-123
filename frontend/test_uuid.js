const { v5: uuidv5 } = require('uuid');

async function testUUIDs() {
    const email = 'spandanpatra1234@gmail.com';
    const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    // 1. Expected UUID from standard library
    const expected = uuidv5(email.toLowerCase().trim(), NAMESPACE);

    // 2. Custom Web Crypto Implementation
    // We have to use Node's crypto here to simulate Web Crypto for the test
    const crypto = globalThis.crypto || require('crypto').webcrypto;

    const nsHex = NAMESPACE.replace(/-/g, '');
    const nsBytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        nsBytes[i] = parseInt(nsHex.substring(i * 2, i * 2 + 2), 16);
    }

    const nameBytes = new TextEncoder().encode(email.toLowerCase().trim());

    // Combine namespace and name
    const combined = new Uint8Array(16 + nameBytes.length);
    combined.set(nsBytes);
    combined.set(nameBytes, 16);

    const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
    const hashBytes = new Uint8Array(hashBuffer);

    // Set version to 5 (0101)
    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
    // Set variant to RFC4122 (10)
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

    const hex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const actual = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

    console.log("Expected (uuidv5) :", expected);
    console.log("Actual (WebCrypto):", actual);
    console.log("Match? :", expected === actual ? "✅ YES!" : "❌ NO!");
}

testUUIDs().catch(console.error);
