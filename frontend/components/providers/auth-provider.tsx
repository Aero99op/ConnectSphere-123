"use client";

import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { createContext, useContext, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

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
    isAuthenticated: boolean;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    supabase: getSupabase(),
    isAuthenticated: false,
    loading: true,
    signOut: async () => { },
});

function AuthContextProvider({ children }: { children: React.ReactNode }) {
    const { data: nextAuthSession, status: nextAuthStatus } = useSession();

    const loading = nextAuthStatus === 'loading';

    const supabaseContextClient = useMemo(() => {
        // If NextAuth has a session, use its injected token
        const nextAuthToken = (nextAuthSession as any)?.supabaseAccessToken;
        if (nextAuthToken) {
            // Force create a specific client for this session if it doesn't match
            // but we must use a stable reference or avoid GoTrue multiple instances.
            return createClient(supabaseUrl, supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
                global: { 
                    headers: { 
                        'apikey': supabaseAnonKey,
                        'Authorization': `Bearer ${nextAuthToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    } 
                }
            });
        }

        // If no NextAuth session but we DO have a native Supabase login, 
        // the client itself manages the token seamlessly, just return the singleton
        return getSupabase();
    }, [(nextAuthSession as any)?.supabaseAccessToken]);

    // Construct unified User object (Memoized to prevent infinite re-renders in consumers like OnboardingGuard)
    const unifiedUser = useMemo(() => {
        if (nextAuthSession?.user) {
            return {
                id: (nextAuthSession as any).user.id as string,
                email: nextAuthSession.user.email as string,
                name: nextAuthSession.user.name as string,
                image: nextAuthSession.user.image as string | undefined,
            };
        }
        return null;
    }, [nextAuthSession?.user]);

    const handleSignOut = async () => {
        // Sign out of both systems to be safe
        await getSupabase().auth.signOut();
        await nextAuthSignOut({ callbackUrl: '/role-selection' });
    };

    const isAuthenticated = !!(nextAuthSession as any)?.supabaseAccessToken;

    const contextValue = useMemo(() => ({
        user: unifiedUser,
        session: unifiedUser ? { user: unifiedUser } : null,
        supabase: supabaseContextClient,
        isAuthenticated,
        loading,
        signOut: handleSignOut,
    }), [unifiedUser, supabaseContextClient, isAuthenticated, loading]);

    return (
        <AuthContext.Provider value={contextValue}>
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
