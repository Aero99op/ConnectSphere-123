import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Supabase credentials missing! Please check your .env.local file.");
}

// Default anonymous client (for pages not yet migrated or public data)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Legacy export for backwards compatibility during migration
export const supabaseLegacy = createClientComponentClient();
