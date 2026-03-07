import NextAuth, { CredentialsSignin } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { signSupabaseJWT, createAdminSupabaseClient, emailToUUID, hashPassword, legacyHash } from '@/lib/auth';

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
                    const inputHash = await hashPassword(credentials.password as string);

                    // 1. Try modern salted UUID
                    const userId = await emailToUUID(email);
                    const adminSupabase = createAdminSupabaseClient();

                    let { data: profile } = await adminSupabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url, password_hash, role, email_verified')
                        .eq('id', userId)
                        .maybeSingle();

                    // 2. Legacy Fallback (Unsalted UUID)
                    if (!profile) {
                        const legacyId = await emailToUUID(email, ""); // No salt
                        const { data: legacyProfile } = await adminSupabase
                            .from('profiles')
                            .select('id, email, full_name, avatar_url, password_hash, role, email_verified')
                            .eq('id', legacyId)
                            .maybeSingle();
                        profile = legacyProfile;
                    }

                    if (!profile || !profile.email_verified || !profile.password_hash) {
                        console.error("Authorize: Profile not found or not verified");
                        return null;
                    }

                    // 3. Password Check (Modern PBKDF2 or Legacy SHA-256)
                    const isModernMatch = inputHash === profile.password_hash;
                    const isLegacyMatch = await legacyHash(credentials.password as string) === profile.password_hash;

                    if (!isModernMatch && !isLegacyMatch) {
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
                    // 1. Try salted UUID (Modern)
                    const saltedId = await emailToUUID(user.email);
                    const adminSupabase = createAdminSupabaseClient();

                    let { data: existingProfile } = await adminSupabase
                        .from('profiles')
                        .select('id')
                        .eq('id', saltedId)
                        .maybeSingle();

                    // 2. Try legacy UUID (Fallback)
                    let finalUserId = saltedId;
                    if (!existingProfile) {
                        const legacyId = await emailToUUID(user.email, "");
                        const { data: legacyProfile } = await adminSupabase
                            .from('profiles')
                            .select('id')
                            .eq('id', legacyId)
                            .maybeSingle();

                        if (legacyProfile) {
                            existingProfile = legacyProfile;
                            finalUserId = legacyId;
                        }
                    }

                    if (!existingProfile) {
                        const { error: insertError } = await adminSupabase.from('profiles').insert({
                            id: finalUserId,
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
                    user.id = finalUserId;
                }
            } catch (err) {
                console.error("Critical error in NextAuth signIn callback:", err);
            }
            return true;
        },
        async jwt({ token, user, account }) {
            try {
                // On initial sign in, use the ID already determined by authorize or signIn callback
                if (user) {
                    token.userId = user.id; // Correct: already handled legacy fallback
                    token.email = user.email;
                    token.name = user.name;
                    token.picture = user.image;

                    // Sign a Supabase-compatible JWT
                    if (process.env.SUPABASE_JWT_SECRET) {
                        token.supabaseAccessToken = await signSupabaseJWT(user.id as string, user.email!);
                    } else {
                        console.warn("🚨 SUPABASE_JWT_SECRET is missing! Supabase real-time/RLS might fail.");
                    }
                }

                // Refresh Supabase JWT if it's about to expire
                const supabaseTokenExp = token.supabaseTokenExp as number | undefined;
                const sixDaysMs = 6 * 24 * 60 * 60 * 1000;

                if (process.env.SUPABASE_JWT_SECRET && (!supabaseTokenExp || Date.now() > (supabaseTokenExp - sixDaysMs / 2))) {
                    token.supabaseAccessToken = await signSupabaseJWT(
                        (token.userId as string) || (token.sub as string),
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
        maxAge: 30 * 24 * 60 * 60, // 30 Days (Standard Hardened Security)
    },
    // NextAuth v5 treats 'secret' as 'AUTH_SECRET' environment variable primarily
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fallback_secret_for_build",
    trustHost: true,
    // Explicitly define URL if present to prevent auto-detection failures on Cloudflare Edge
    basePath: "/api/auth",
    debug: process.env.NODE_ENV === 'development',
});
