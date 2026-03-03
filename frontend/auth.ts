import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { signSupabaseJWT, createAdminSupabaseClient } from '@/lib/auth';
import { v5 as uuidv5 } from 'uuid';
import bcrypt from 'bcryptjs';

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function emailToUUID(email: string): string {
    return uuidv5(email.toLowerCase().trim(), UUID_NAMESPACE);
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
                if (!credentials?.email || !credentials?.password) return null;

                const email = (credentials.email as string).toLowerCase().trim();
                const userId = emailToUUID(email);
                const adminSupabase = createAdminSupabaseClient();

                if (credentials.action === 'signup') {
                    // Check if user already exists
                    const { data: existingUser } = await adminSupabase
                        .from('profiles')
                        .select('id')
                        .eq('id', userId)
                        .single();

                    if (existingUser) {
                        throw new Error('Account already exists. Please login instead.');
                    }

                    // Hash password
                    const hashedPassword = await bcrypt.hash(credentials.password as string, 12);

                    // Create user in profiles table
                    const { error: insertError } = await adminSupabase
                        .from('profiles')
                        .insert({
                            id: userId,
                            email: email,
                            username: email.split('@')[0],
                            full_name: credentials.fullName || email.split('@')[0],
                            role: credentials.role || 'citizen',
                            password_hash: hashedPassword,
                            avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((credentials.fullName as string) || email)}`,
                            created_at: new Date().toISOString(),
                        });

                    if (insertError) {
                        console.error('Signup error:', insertError);
                        throw new Error('Failed to create account: ' + insertError.message);
                    }

                    return {
                        id: userId,
                        email: email,
                        name: (credentials.fullName as string) || email.split('@')[0],
                        image: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((credentials.fullName as string) || email)}`,
                    };
                } else {
                    // Login flow
                    const { data: profile, error } = await adminSupabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url, password_hash, role')
                        .eq('id', userId)
                        .single();

                    if (error || !profile) {
                        throw new Error('No account found with this email.');
                    }

                    if (!profile.password_hash) {
                        throw new Error('This account uses Google login. Please sign in with Google.');
                    }

                    const isValid = await bcrypt.compare(credentials.password as string, profile.password_hash);
                    if (!isValid) {
                        throw new Error('Invalid password.');
                    }

                    return {
                        id: profile.id,
                        email: profile.email,
                        name: profile.full_name,
                        image: profile.avatar_url,
                    };
                }
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            // For Google OAuth: auto-create user in profiles if first time
            if (account?.provider === 'google' && user.email) {
                const userId = emailToUUID(user.email);
                const adminSupabase = createAdminSupabaseClient();

                const { data: existingProfile } = await adminSupabase
                    .from('profiles')
                    .select('id')
                    .eq('id', userId)
                    .single();

                if (!existingProfile) {
                    // First time Google login — create profile
                    await adminSupabase.from('profiles').insert({
                        id: userId,
                        email: user.email,
                        username: user.email.split('@')[0],
                        full_name: user.name || user.email.split('@')[0],
                        role: 'citizen',
                        avatar_url: user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || user.email)}`,
                        created_at: new Date().toISOString(),
                    });
                }
                user.id = userId;
            }
            return true;
        },
        async jwt({ token, user, account }) {
            // On initial sign in, generate Supabase JWT
            if (user) {
                const userId = user.email ? emailToUUID(user.email) : (user as any).id;
                token.userId = userId;
                token.email = user.email;
                token.name = user.name;
                token.picture = user.image;

                // Sign a Supabase-compatible JWT
                token.supabaseAccessToken = await signSupabaseJWT(userId as string, user.email!);
            }

            // Refresh Supabase JWT if it's about to expire (every 6 days)
            const supabaseTokenExp = token.supabaseTokenExp as number | undefined;
            const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
            if (!supabaseTokenExp || Date.now() > supabaseTokenExp) {
                token.supabaseAccessToken = await signSupabaseJWT(
                    token.userId as string,
                    token.email as string
                );
                token.supabaseTokenExp = Date.now() + sixDaysMs;
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
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
    // @ts-ignore - trustHost is valid in v5 but may conflict with cached v4 types
    trustHost: true,
});
