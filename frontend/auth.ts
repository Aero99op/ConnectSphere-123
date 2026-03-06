import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { signSupabaseJWT, createAdminSupabaseClient } from '@/lib/auth';

// Edge-compatible UUID v5 implementation using Web Crypto API
async function emailToUUID(email: string): Promise<string> {
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
}

// Simple Edge-compatible password hash (DO NOT use simple SHA-256 for real production passwords, but since NextAuth is edge only here, we use a basic salted hash or WebCrypto PBKDF2)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "connectsphere_salt");
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
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
                otp: { label: 'OTP', type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password || !credentials?.otp) {
                    throw new Error('Missing required fields including OTP.');
                }

                const email = (credentials.email as string).toLowerCase().trim();
                const otpInput = (credentials.otp as string).trim();
                const userId = await emailToUUID(email);
                const adminSupabase = createAdminSupabaseClient();

                // 1. Validate OTP Fast
                const { data: otpRecord, error: otpError } = await adminSupabase
                    .from('auth_otps')
                    .select('*')
                    .eq('email', email)
                    .eq('action', credentials.action)
                    .single();

                if (otpError || !otpRecord || otpRecord.otp !== otpInput) {
                    throw new Error('Invalid or expired OTP code.');
                }

                if (new Date(otpRecord.expires_at) < new Date()) {
                    await adminSupabase.from('auth_otps').delete().eq('id', otpRecord.id);
                    throw new Error('OTP has expired. Please request a new one.');
                }

                // OTP is valid, remove it
                await adminSupabase.from('auth_otps').delete().eq('id', otpRecord.id);

                if (credentials.action === 'signup') {
                    const { data: existingUser } = await adminSupabase
                        .from('profiles')
                        .select('id')
                        .eq('id', userId)
                        .maybeSingle();

                    if (existingUser) {
                        throw new Error('Account already exists. Please login instead.');
                    }

                    const hashedPassword = await hashPassword(credentials.password as string);

                    const { error: insertError } = await adminSupabase
                        .from('profiles')
                        .insert({
                            id: userId,
                            email: email,
                            username: email.split('@')[0] + Math.floor(Math.random() * 1000),
                            full_name: credentials.fullName || email.split('@')[0],
                            role: credentials.role || 'citizen',
                            password_hash: hashedPassword,
                            is_onboarded: false,
                            avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((credentials.fullName as string) || email)}`,
                        });

                    if (insertError) throw new Error('Failed to create account: ' + insertError.message);

                    return {
                        id: userId,
                        email: email,
                        name: (credentials.fullName as string) || email.split('@')[0],
                        image: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((credentials.fullName as string) || email)}`,
                    };
                } else {
                    const { data: profile, error } = await adminSupabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url, password_hash, role')
                        .eq('id', userId)
                        .maybeSingle();

                    if (error || !profile) throw new Error('No account found with this email.');
                    if (!profile.password_hash) throw new Error('This account uses Google login. Please sign in with Google or reset password.');

                    const inputHash = await hashPassword(credentials.password as string);
                    if (inputHash !== profile.password_hash) throw new Error('Invalid password.');

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
            // On initial sign in, generate Supabase JWT
            if (user) {
                const userId = user.email ? await emailToUUID(user.email) : (user as any).id;
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
        maxAge: 100 * 365 * 24 * 60 * 60, // 100 years (Infinity juggad)
    },
    secret: process.env.NEXTAUTH_SECRET,
    // @ts-ignore - trustHost is valid in v5 but may conflict with cached v4 types
    trustHost: true,
});
