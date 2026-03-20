import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Supabase credentials missing! Please check your .env.local file.");
}

// Use globalThis to maintain a true singleton across Next.js HMR and React StrictMode
declare global {
    var _supabaseInstance: SupabaseClient | undefined;
    var _supabaseAuthenticatedClients: Map<string, SupabaseClient> | undefined;
}

if (!globalThis._supabaseAuthenticatedClients) {
    globalThis._supabaseAuthenticatedClients = new Map();
}

export const getSupabase = (token?: string) => {
    if (token) {
        if (!globalThis._supabaseAuthenticatedClients!.has(token)) {
            const client = createClient(supabaseUrl, supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
                global: { 
                    headers: { 
                        'apikey': supabaseAnonKey,
                        'Authorization': `Bearer ${token}`
                    } 
                }
            });
            globalThis._supabaseAuthenticatedClients!.set(token, client);
        }
        return globalThis._supabaseAuthenticatedClients!.get(token)!;
    }

    if (!globalThis._supabaseInstance && supabaseUrl && supabaseAnonKey) {
        globalThis._supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { headers: { 'apikey': supabaseAnonKey } }
        });
    }
    return globalThis._supabaseInstance!;
};

// Legacy export for compatibility, but better to use getSupabase()
export const supabase = getSupabase();
