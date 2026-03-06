import NextAuth, { CredentialsSignin } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { signSupabaseJWT, createAdminSupabaseClient } from '@/lib/auth';

// Edge-compatible UUID v5 implementation using Web Crypto API
async function emailToUUID(email: string): Promise<string> {
    try {
        const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

        // Convert namespace UUID string to bytes
        const nsHex = NAMESPACE.replace(/-/g, '');
        const nsBytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            nsBytes[i] = parseInt(nsHex.substring(i * 2, i * 2 + 2), 16);
        }

        const nameBytes = new TextEncoder().encode(email.toLowerCase().trim());

        // Combine namespace and name
        const combined = new Uint8Array(16 + nameBytes.length);
        combined.set(nsBytes);
        combined.set(nameBytes, 16);

        // SHA-1 hash for v5
        const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
        const hashBytes = new Uint8Array(hashBuffer);

        // Set version to 5 (0101)
        hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
        // Set variant to RFC4122 (10)
        hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

        const hex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch (e) {
        console.error("WebCrypto failed for UUID:", e);
        // Fallback juggad if WebCrypto fails on Edge: generate a pseudo-UUID based on string char codes
        let hash = 0;
        for (let i = 0; i < email.length; i++) hash = Math.imul(31, hash) + email.charCodeAt(i) | 0;
        const hex = Math.abs(hash).toString(16).padStart(32, '0');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
}

// Simple Edge-compatible password hash
async function hashPassword(password: string): Promise<string> {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + "connectsphere_salt");
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error("WebCrypto failed for Password Hash:", e);
        // Fallback juggad if WebCrypto fails on Edge
        return Buffer.from(password + "connectsphere_salt").toString('base64');
    }
}

// Ensure trust host is globally defined for Edge runtime (Cloudflare NextAuth bug)
if (!process.env.AUTH_TRUST_HOST) {
    process.env.AUTH_TRUST_HOST = "true";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    prompt: "select_account"
                }
            }
        }),
        Credentials({
            name: 'Email & Password',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                action: { label: 'Action', type: 'text' }, // "login" or "signup"
                fullName: { label: 'Full Name', type: 'text' },
                role: { label: 'Role', type: 'text' },
            },
            async authorize(credentials) {
                try {
                    if (!credentials?.email || !credentials?.password) return null;

                    const email = (credentials.email as string).toLowerCase().trim();
                    const userId = await emailToUUID(email);

                    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
                        console.error("🚨 Missing Supabase Env Variables in Cloudflare!");
                        return null;
                    }

                    const adminSupabase = createAdminSupabaseClient();

                    // Get profile with verified status
                    const { data: profile, error } = await adminSupabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url, password_hash, role, email_verified')
                        .eq('id', userId)
                        .maybeSingle();

                    if (error || !profile || !profile.email_verified || !profile.password_hash) {
                        console.error("Authorize: Profile not found or not verified");
                        return null;
                    }

                    const inputHash = await hashPassword(credentials.password as string);
                    if (inputHash !== profile.password_hash) {
                        console.error("Authorize: Password mismatch");
                        return null;
                    }

                    return {
                        id: profile.id,
                        email: profile.email,
                        name: profile.full_name,
                        image: profile.avatar_url,
                    };
                } catch (err) {
                    console.error("🚨 CRITICAL CRASH in authorize:", err);
                    return null; // Return null instead of throwing to NEVER trigger the 'Configuration' error
                }
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider === 'google' && user.email) {
                    const userId = await emailToUUID(user.email);
                    const adminSupabase = createAdminSupabaseClient();

                    const { data: existingProfile } = await adminSupabase
                        .from('profiles')
                        .select('id')
                        .eq('id', userId)
                        .maybeSingle();

                    if (!existingProfile) {
                        const { error: insertError } = await adminSupabase.from('profiles').insert({
                            id: userId,
                            email: user.email,
                            username: user.email.split('@')[0] + Math.floor(Math.random() * 1000),
                            full_name: user.name || user.email.split('@')[0],
                            role: 'citizen',
                            is_onboarded: false,
                            avatar_url: user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || user.email)}`,
                        });

                        if (insertError) {
                            console.error("Profile creation error during Google Auth:", insertError);
                        }
                    }
                    user.id = userId;
                }
            } catch (err) {
                console.error("Critical error in NextAuth signIn callback:", err);
            }
            return true;
        },
        async jwt({ token, user, account }) {
            try {
                // On initial sign in, generate Supabase JWT
                if (user) {
                    const userId = user.email ? await emailToUUID(user.email) : (user as any).id;
                    token.userId = userId;
                    token.email = user.email;
                    token.name = user.name;
                    token.picture = user.image;

                    // Sign a Supabase-compatible JWT
                    if (process.env.SUPABASE_JWT_SECRET) {
                        token.supabaseAccessToken = await signSupabaseJWT(userId as string, user.email!);
                    } else {
                        console.warn("🚨 SUPABASE_JWT_SECRET is missing! Supabase real-time/RLS might fail.");
                    }
                }

                // Refresh Supabase JWT if it's about to expire
                const supabaseTokenExp = token.supabaseTokenExp as number | undefined;
                const sixDaysMs = 6 * 24 * 60 * 60 * 1000;

                if (process.env.SUPABASE_JWT_SECRET && (!supabaseTokenExp || Date.now() > supabaseTokenExp)) {
                    token.supabaseAccessToken = await signSupabaseJWT(
                        token.userId as string,
                        token.email as string
                    );
                    token.supabaseTokenExp = Date.now() + sixDaysMs;
                }
            } catch (err) {
                console.error("🚨 CRITICAL ERROR in NextAuth jwt callback:", err);
            }

            return token;
        },
        async session({ session, token }) {
            // Pass custom data to the client session
            if (session?.user) {
                (session.user as any).id = token.userId as string;
                (session as any).supabaseAccessToken = token.supabaseAccessToken;
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
            // Allows relative callback URLs (e.g. /homefeed, /profile)
            if (url.startsWith("/")) return `${baseUrl}${url}`;

            // Ensure our specific domains with ANY sub URL are explicitly allowed
            // Added current Cloudflare origin explicitly
            if (
                url.startsWith("http://localhost:3000") ||
                url.startsWith("https://connectsphere-123.pages.dev")
            ) {
                return url;
            }

            // Fallback for same origin
            try {
                if (new URL(url).origin === baseUrl) return url;
            } catch (error) {
                // Ignore URL parsing errors and fallback to safety
            }

            return baseUrl;
        },
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 100 * 365 * 24 * 60 * 60, // 100 years (Infinity juggad)
    },
    // NextAuth v5 treats 'secret' as 'AUTH_SECRET' environment variable primarily
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fallback_secret_for_build",
    trustHost: true,
    // Explicitly define URL if present to prevent auto-detection failures on Cloudflare Edge
    basePath: "/api/auth",
    debug: process.env.NODE_ENV === 'development',
});
