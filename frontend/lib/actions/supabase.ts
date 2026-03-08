import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for Server Actions.
 * This client uses the service role key or non-prefixed env variables 
 * to ensure credentials never reach the browser.
 */
export function createServerSupabase() {
    // We use service role key for all-access server-side logic (Use with CAUTION)
    // Or we could use the anon key if we just want to leverage RLS as 'authenticated'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });
}
