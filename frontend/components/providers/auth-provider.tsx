"use client";

import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { createContext, useContext, useMemo, useState, useEffect } from 'react';
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
    const { data: nextAuthSession, status: nextAuthStatus } = useSession();

    const [nativeSession, setNativeSession] = useState<any>(null);
    const [isNativeLoading, setIsNativeLoading] = useState(true);

    // Listen to native Supabase Auth changes (for our "failover" login button)
    useEffect(() => {
        let mounted = true;

        const getSession = async () => {
            const { data } = await anonSupabase.auth.getSession();
            if (mounted) {
                setNativeSession(data.session);
                setIsNativeLoading(false);
            }
        };

        getSession();

        const { data: { subscription } } = anonSupabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setNativeSession(session);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const loading = nextAuthStatus === 'loading' || isNativeLoading;

    const supabaseContextClient = useMemo(() => {
        // If NextAuth has a session, use its injected token
        const nextAuthToken = (nextAuthSession as any)?.supabaseAccessToken;
        if (nextAuthToken) {
            return createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                },
                global: { headers: { Authorization: `Bearer ${nextAuthToken}` } },
                realtime: {
                    params: { apikey: supabaseAnonKey },
                    headers: { Authorization: `Bearer ${nextAuthToken}` },
                },
            });
        }

        // If no NextAuth session but we DO have a native Supabase login, 
        // the client itself manages the token seamlessly, just return anonSupabase
        // because auth instance inside it is already aware of the session
        return anonSupabase;
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
        } else if (nativeSession?.user) {
            return {
                id: nativeSession.user.id,
                email: nativeSession.user.email || '',
                name: nativeSession.user.user_metadata?.full_name || nativeSession.user.email?.split('@')[0] || 'User',
                image: nativeSession.user.user_metadata?.avatar_url,
            };
        }
        return null;
    }, [nextAuthSession?.user, nativeSession?.user]);

    const handleSignOut = async () => {
        // Sign out of both systems to be safe
        await anonSupabase.auth.signOut();
        await nextAuthSignOut({ callbackUrl: '/role-selection' });
    };

    const contextValue = useMemo(() => ({
        user: unifiedUser,
        session: unifiedUser ? { user: unifiedUser } : null,
        supabase: supabaseContextClient,
        loading,
        signOut: handleSignOut,
    }), [unifiedUser, supabaseContextClient, loading]);

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
