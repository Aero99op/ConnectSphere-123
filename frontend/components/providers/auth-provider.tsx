"use client";

import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { createContext, useContext, useMemo, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { hasDeviceKeys, generateDeviceKeys, importDeviceKeysFromDB, getLocalPublicKeys, setActiveUserId, bufferToBase64, keyStore } from '@/lib/crypto/e2ee';

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
                
                // Fetch profile to check what's in DB
                const { data: profile } = await supabaseContextClient
                    .from('profiles')
                    .select('ecdh_private_jwk, ecdsa_private_jwk, mlkem_private_b64, ecdh_public_key, ecdsa_public_key')
                    .eq('id', unifiedUser.id)
                    .single();

                if (!hasKeys) {
                    if (profile?.ecdh_private_jwk && profile?.ecdsa_private_jwk && profile?.mlkem_private_b64) {
                        // Case 1: Fresh browser, DB has keys -> DOWNLOAD
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
                        // Case 2: Fresh browser, DB empty -> GENERATE & UPLOAD
                        console.log("[E2EE] No keys found — generating new device keys...");
                        const { ecdhPublicJwk, ecdsaPublicJwk, mlkemPublic, ecdhPrivateJwk, ecdsaPrivateJwk, mlkemPrivateB64 } = await generateDeviceKeys();
                        
                        await supabaseContextClient.from('profiles').update({ 
                            ecdh_public_key: JSON.stringify(ecdhPublicJwk), 
                            ecdsa_public_key: JSON.stringify(ecdsaPublicJwk),
                            mlkem_public_key: mlkemPublic,
                            ecdh_private_jwk: JSON.stringify(ecdhPrivateJwk),
                            ecdsa_private_jwk: JSON.stringify(ecdsaPrivateJwk),
                            mlkem_private_b64: mlkemPrivateB64
                        }).eq('id', unifiedUser.id);
                        console.log("[E2EE] ✅ Keys generated and synced to DB.");
                    }
                } else {
                    // Case 3: Browser HAS keys, check if they are in sync with DB
                    const { ecdh: localEcdh } = await getLocalPublicKeys();
                    const localEcdhStr = localEcdh ? JSON.stringify(localEcdh) : null;
                    
                    if (!profile?.ecdh_private_jwk && localEcdh) {
                        // DB empty but we have local keys -> UPLOAD OURS AS MASTER
                        console.log("[E2EE] Local keys exist but DB empty — seeding sync from this device...");
                        const ecdhPriv = await keyStore.getKey("ecdh_private") as CryptoKey;
                        const ecdsaPriv = await keyStore.getKey("ecdsa_private") as CryptoKey;
                        const mlkemPriv = await keyStore.getKey("mlkem_private") as Uint8Array;
                        
                        try {
                            const ecdhPrivateJwk = await crypto.subtle.exportKey("jwk", ecdhPriv);
                            const ecdsaPrivateJwk = await crypto.subtle.exportKey("jwk", ecdsaPriv);
                            
                            await supabaseContextClient.from('profiles').update({ 
                                ecdh_private_jwk: JSON.stringify(ecdhPrivateJwk),
                                ecdsa_private_jwk: JSON.stringify(ecdsaPrivateJwk),
                                mlkem_private_b64: bufferToBase64(mlkemPriv)
                            }).eq('id', unifiedUser.id);
                            console.log("[E2EE] ✅ Sync seeded successfully.");
                        } catch (e) {
                            // Legacy non-extractable keys? Upgrade them.
                            console.log("[E2EE] Upgrading legacy keys for sync support...");
                            const keys = await generateDeviceKeys();
                            await supabaseContextClient.from('profiles').update({ 
                                ecdh_public_key: JSON.stringify(keys.ecdhPublicJwk), 
                                ecdsa_public_key: JSON.stringify(keys.ecdsaPublicJwk),
                                mlkem_public_key: keys.mlkemPublic,
                                ecdh_private_jwk: JSON.stringify(keys.ecdhPrivateJwk),
                                ecdsa_private_jwk: JSON.stringify(keys.ecdsaPrivateJwk),
                                mlkem_private_b64: keys.mlkemPrivateB64
                            }).eq('id', unifiedUser.id);
                        }
                    } else if (profile?.ecdh_private_jwk && profile?.ecdh_public_key !== localEcdhStr) {
                        // CONFLICT: This browser has keys but they don't match the DB MASTER KEYS
                        console.log("[E2EE] Local keys out of sync — auto-correcting from DB...");
                        await importDeviceKeysFromDB(
                            profile.ecdh_private_jwk,
                            profile.ecdsa_private_jwk,
                            profile.mlkem_private_b64,
                            profile.ecdh_public_key,
                            profile.ecdsa_public_key
                        );
                        console.log("[E2EE] ✅ Auto-sync complete!");
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
