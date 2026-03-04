import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Supabase credentials missing! Please check your .env.local file.");
}

let _supabase: SupabaseClient | null = null;

// Singleton pattern to prevent "Multiple GoTrueClient instances detected"
export const getSupabase = () => {
    if (!_supabase && supabaseUrl && supabaseAnonKey) {
        _supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            }
        });
    }
    return _supabase!;
};

// Legacy export for compatibility, but better to use getSupabase()
export const supabase = getSupabase();
