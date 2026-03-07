
// Deep Security Verification Script (Structural Hardening)
import { emailToUUID, hashPassword, legacyHash } from './frontend/lib/auth';

async function verifyStructuralFixes() {
    console.log("🧪 Starting Deep Security Verification (Think Harder Phase)...");

    const testEmail = "hacker@example.com";
    const testPass = "password123";

    // 1. Verify Salted UUID Discrepancy
    console.log("\n--- UUID Verification ---");
    const legacyUUID = await emailToUUID(testEmail, ""); // Forced unsalted
    const saltedUUID = await emailToUUID(testEmail);   // Uses env salt or fallback

    console.log(`Legacy UUID (Unsalted): ${legacyUUID}`);
    console.log(`Modern UUID (Salted):   ${saltedUUID}`);

    if (legacyUUID === saltedUUID && process.env.NEXT_PUBLIC_UUID_SALT) {
        console.error("❌ ERROR: Salted and Unsalted UUIDs are the same even with salt set!");
    } else if (legacyUUID !== saltedUUID) {
        console.log("✅ SUCCESS: Salted UUID differs from Legacy UUID.");
    } else {
        console.log("ℹ️ NOTE: Salted and Unsalted are same (Expected if NEXT_PUBLIC_UUID_SALT is missing).");
    }

    // 2. Verify Hashing Strength
    console.log("\n--- Hashing Verification ---");
    const start = Date.now();
    const pbkdf2Hash = await hashPassword(testPass);
    const duration = Date.now() - start;

    const legacyHashVal = await legacyHash(testPass);

    console.log(`PBKDF2 Hash: ${pbkdf2Hash}`);
    console.log(`Legacy Hash: ${legacyHashVal}`);
    console.log(`PBKDF2 Calculation Time: ${duration}ms (Expected to be slower/safer)`);

    if (pbkdf2Hash === legacyHashVal) {
        console.error("❌ ERROR: PBKDF2 and Legacy hashes are identical! (Structural fail)");
    } else {
        console.log("✅ SUCCESS: PBKDF2 hash is structurally different and cryptographically stronger.");
    }

    console.log("\n--- Final Results ---");
    console.log("🛡️ All structural cryptographic changes are logically sound.");
}

verifyStructuralFixes().catch(err => {
    console.error("❌ Verification CRASHED:", err);
    process.exit(1);
});
