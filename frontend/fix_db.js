require('dotenv').config({ path: 'd:/connectsphere1/frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function fixDatabase() {
    console.log("Checking for orphaned sessions/profiles...");

    // Find the specific user the user has been having trouble with
    const testEmail = 'spandanpatra1234@gmail.com';

    // We can't delete from NextAuth sessions from here because NextAuth uses JWTs (cookies),
    // but we CAN ensure the profile exists if the user ID is known. Or we delete any partial profiles.

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', testEmail);

    if (error) {
        console.error("DB Error:", error);
    } else if (profiles && profiles.length > 0) {
        console.log(`Found ${profiles.length} profiles for ${testEmail}:`, profiles);
        // Let's ensure is_onboarded is true so we don't get stuck there
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ is_onboarded: true })
            .eq('email', testEmail);
        console.log("Updated existing profile onboarding status. Error:", updateError);
    } else {
        console.log(`No profile found for ${testEmail}. It was completely missing.`);
    }

    // Since the issue is NextAuth holding a JWT for a non-existent DB row, 
    // the only WAY to fix a user caught in this state is for them to LOG OUT.
    // However, they can't log out if the app crashes on the profile page or if it redirects.
    // The profile page `handleLogout` calls NextAuth `signOut()`. But if the page errors out, it's blocked.
    // wait, the profile page falls back to: 
    // setProfile({ full_name: "User Not Found", username: "unknown" });
    // So the user CAN click the logout button (the top right LogOut icon).

    console.log("Database look up complete.");
}

fixDatabase().catch(console.error);
