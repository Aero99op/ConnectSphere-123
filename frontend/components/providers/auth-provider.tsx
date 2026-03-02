"use client";

import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { createContext, useContext, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface AuthContextType {
    user: {
        id: string;
        email: string;
        name: string;
        image?: string;
    } | null;
    session: {
        user: {
            id: string;
            email: string;
            name: string;
            image?: string;
        };
    } | null;
    supabase: SupabaseClient;
    loading: boolean;
    signOut: () => Promise<void>;
}

// Anon client for unauthenticated state
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    supabase: anonSupabase,
    loading: true,
    signOut: async () => { },
});

function AuthContextProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const loading = status === 'loading';

    // Create an authenticated Supabase client with the custom JWT
    const supabase = useMemo(() => {
        const accessToken = (session as any)?.supabaseAccessToken;
        if (!accessToken) return anonSupabase;

        return createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
            realtime: {
                params: {
                    apikey: supabaseAnonKey,
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        });
    }, [(session as any)?.supabaseAccessToken]);

    const user = session?.user ? {
        id: (session as any).user.id as string,
        email: session.user.email as string,
        name: session.user.name as string,
        image: session.user.image as string | undefined,
    } : null;

    const handleSignOut = async () => {
        await nextAuthSignOut({ callbackUrl: '/role-selection' });
    };

    return (
        <AuthContext.Provider value={{
            user,
            session: user ? { user } : null,
            supabase,
            loading,
            signOut: handleSignOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Drop-in replacement for supabase.auth.getUser() everywhere.
 * Returns { user, session, supabase, loading, signOut }
 * 
 * The `supabase` client already has the custom JWT injected,
 * so all queries respect RLS as if using Supabase Auth.
 */
export function useAuth() {
    return useContext(AuthContext);
}

/**
 * Wrap your app with this provider in layout.tsx
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AuthContextProvider>
                {children}
            </AuthContextProvider>
        </SessionProvider>
    );
}
