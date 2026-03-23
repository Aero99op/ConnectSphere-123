"use client";

import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { createContext, useContext, useMemo, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { hasDeviceKeys, generateDeviceKeys, importDeviceKeysFromDB, setActiveUserId } from '@/lib/crypto/e2ee';

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
        return getSupabase(nextAuthToken);
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

    // E2EE Device Key Injection logic
    useEffect(() => {
        if (!unifiedUser || !supabaseContextClient) return;
        
        const initE2E = async () => {
            try {
                setActiveUserId(unifiedUser.id);
                const hasKeys = await hasDeviceKeys();
                
                if (!hasKeys) {
                    // Step 1: Try downloading keys from DB (cross-device sync)
                    const { data: profile } = await supabaseContextClient
                        .from('profiles')
                        .select('ecdh_private_jwk, ecdsa_private_jwk, mlkem_private_b64, ecdh_public_key, ecdsa_public_key')
                        .eq('id', unifiedUser.id)
                        .single();

                    if (profile?.ecdh_private_jwk && profile?.ecdsa_private_jwk && profile?.mlkem_private_b64) {
                        // Keys exist in DB from another device — download and import!
                        console.log("[E2EE] Downloading keys from DB (cross-device sync)...");
                        await importDeviceKeysFromDB(
                            profile.ecdh_private_jwk,
                            profile.ecdsa_private_jwk,
                            profile.mlkem_private_b64,
                            profile.ecdh_public_key,
                            profile.ecdsa_public_key
                        );
                        console.log("[E2EE] ✅ Keys synced from another device!");
                    } else {
                        // Step 2: No keys anywhere — generate fresh ones
                        console.log("[E2EE] No keys found — generating new device keys...");
                        const { ecdhPublicJwk, ecdsaPublicJwk, mlkemPublic, ecdhPrivateJwk, ecdsaPrivateJwk, mlkemPrivateB64 } = await generateDeviceKeys();
                        
                        const { error } = await supabaseContextClient
                            .from('profiles')
                            .update({ 
                                ecdh_public_key: JSON.stringify(ecdhPublicJwk), 
                                ecdsa_public_key: JSON.stringify(ecdsaPublicJwk),
                                mlkem_public_key: mlkemPublic,
                                // Store private keys for cross-device sync (RLS protected)
                                ecdh_private_jwk: JSON.stringify(ecdhPrivateJwk),
                                ecdsa_private_jwk: JSON.stringify(ecdsaPrivateJwk),
                                mlkem_private_b64: mlkemPrivateB64
                            })
                            .eq('id', unifiedUser.id);
                            
                        if (error) {
                            console.error("[E2EE] Failed to upload keys:", error);
                        } else {
                            console.log("[E2EE] ✅ Keys generated and synced to DB.");
                        }
                    }
                }
            } catch (err) {
                console.error("[E2EE] Error initializing device keys:", err);
            }
        };

        // Don't block app render, run async
        initE2E();
    }, [unifiedUser, supabaseContextClient]);

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
