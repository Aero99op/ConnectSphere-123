import NextAuth, { CredentialsSignin } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { signSupabaseJWT, createAdminSupabaseClient, emailToUUID, hashPassword, legacyHash } from '@/lib/auth';

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
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
                action: { label: 'Action', type: 'text' },
                fullName: { label: 'Full Name', type: 'text' },
                role: { label: 'Role', type: 'text' },
            },
            async authorize(credentials) {
                try {
                    if (!credentials?.email || !credentials?.password) return null;

                    const email = (credentials.email as string).toLowerCase().trim();
                    const inputHash = await hashPassword(credentials.password as string);

                    const userId = await emailToUUID(email);
                    const adminSupabase = createAdminSupabaseClient();

                    let { data: profile } = await adminSupabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url, password_hash, role, email_verified')
                        .eq('id', userId)
                        .maybeSingle();

                    if (!profile) {
                        const legacyId = await emailToUUID(email, "");
                        const { data: legacyProfile } = await adminSupabase
                            .from('profiles')
                            .select('id, email, full_name, avatar_url, password_hash, role, email_verified')
                            .eq('id', legacyId)
                            .maybeSingle();
                        profile = legacyProfile;
                    }

                    if (!profile || !profile.email_verified || !profile.password_hash) {
                        return null;
                    }

                    const isModernMatch = inputHash === profile.password_hash;
                    const isLegacyMatch = await legacyHash(credentials.password as string) === profile.password_hash;

                    if (!isModernMatch && !isLegacyMatch) {
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
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account }) {
            try {
                if (account?.provider === 'google' && user.email) {
                    const saltedId = await emailToUUID(user.email);
                    const adminSupabase = createAdminSupabaseClient();

                    let { data: existingProfile } = await adminSupabase
                        .from('profiles')
                        .select('id')
                        .eq('id', saltedId)
                        .maybeSingle();

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
                            username: user.email.split('@')[0] + Math.floor(Math.random() * 10000),
                            full_name: user.name || user.email.split('@')[0],
                            role: 'citizen',
                            is_onboarded: false,
                            avatar_url: user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || user.email)}`,
                        });

                        if (insertError) {
                            console.error("🚨 FAILED TO CREATE PROFILE during signIn:", insertError);
                            // If it's a conflict or error, we still want the user to be able to sign in
                            // but this is likely why onboarding fails later.
                        }
                    }
                    user.id = finalUserId;
                }
            } catch (err) {
                console.error("Critical error in NextAuth signIn callback:", err);
            }
            return true;
        },
        async jwt({ token, user }) {
            try {
                if (user) {
                    token.userId = user.id;
                    token.email = user.email;
                    token.name = user.name;
                    token.picture = user.image;

                    if (process.env.SUPABASE_JWT_SECRET) {
                        token.supabaseAccessToken = await signSupabaseJWT(user.id as string, user.email!);
                    }
                }

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
            if (session?.user) {
                (session.user as any).id = token.userId as string;
                (session as any).supabaseAccessToken = token.supabaseAccessToken;
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            if (
                url.startsWith("http://localhost:3000") ||
                url.startsWith("https://connectsphere-123.pages.dev")
            ) {
                return url;
            }
            try {
                if (new URL(url).origin === baseUrl) return url;
            } catch (error) { }
            return baseUrl;
        },
    },
});

