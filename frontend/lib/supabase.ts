import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Supabase credentials missing! Please check your .env.local file.");
}

// Use globalThis to maintain a true singleton across Next.js HMR and React StrictMode
declare global {
    var _supabaseInstance: SupabaseClient | undefined;
    var _supabaseAuthClient: SupabaseClient | undefined;
    var _supabaseAuthToken: string | undefined;
}

// FIX: Use a SINGLE authenticated client that gets reused.
// Instead of creating one client per token (which causes Multiple GoTrueClient warnings),
// we create ONE authenticated client and update its headers when the token changes.
function makeUniqueStorage(tokenSlice: string) {
    // Each client gets unique storage key to prevent GoTrueClient collision warning
    const prefix = `sb-auth-${tokenSlice}-`;
    return {
        getItem: (key: string) => null, // No persistence needed — NextAuth manages sessions
        setItem: (key: string, value: string) => {},
        removeItem: (key: string) => {},
    };
}

export const getSupabase = (token?: string) => {
    if (token) {
        // Reuse existing authenticated client if token hasn't changed
        if (globalThis._supabaseAuthClient && globalThis._supabaseAuthToken === token) {
            return globalThis._supabaseAuthClient;
        }

        // Token changed — create new client with unique storage key
        const tokenSlice = token.substring(token.length - 8);
        const client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storage: makeUniqueStorage(tokenSlice),
                // Use unique storage key to prevent GoTrueClient collision
                storageKey: `sb-auth-${tokenSlice}`,
            },
            global: { 
                headers: { 
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${token}`
                } 
            }
        });

        globalThis._supabaseAuthClient = client;
        globalThis._supabaseAuthToken = token;
        return client;
    }

    if (!globalThis._supabaseInstance && supabaseUrl && supabaseAnonKey) {
        globalThis._supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: 'sb-anon-instance', // Unique key for anon client
            },
            global: { headers: { 'apikey': supabaseAnonKey } }
        });
    }
    return globalThis._supabaseInstance!;
};

// Legacy export for compatibility, but better to use getSupabase()
export const supabase = getSupabase();

