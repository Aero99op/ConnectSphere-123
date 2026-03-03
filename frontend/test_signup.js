require('dotenv').config({ path: 'd:/connectsphere1/frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { v5: uuidv5 } = require('uuid');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
function emailToUUID(email) {
    return uuidv5(email.toLowerCase().trim(), UUID_NAMESPACE);
}

async function simulateSignIn() {
    const testEmail = "testnewuser" + Math.floor(Math.random() * 1000) + "@gmail.com";
    const userId = emailToUUID(testEmail);
    const testName = "Test Naya User";

    console.log("Attempting to insert profile for:", testEmail);

    const { error: insertError } = await supabase.from('profiles').insert({
        id: userId,
        email: testEmail,
        username: testEmail.split('@')[0] + Math.floor(Math.random() * 1000),
        full_name: testName,
        role: 'citizen',
        is_onboarded: false,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=Test`,
    });

    if (insertError) {
        console.error("❌ Profile creation error:", insertError.message, insertError.details, insertError.hint);
        console.log("Full error:", JSON.stringify(insertError, null, 2));
    } else {
        console.log("✅ Profile created successfully! ID:", userId);

        // Clean up
        await supabase.from('profiles').delete().eq('id', userId);
        console.log("Cleaned up test profile.");
    }
}

simulateSignIn().catch(console.error);
