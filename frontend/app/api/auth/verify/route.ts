import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, emailToUUID, hashPassword } from '@/lib/auth';

export const runtime = 'edge';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token')?.trim();
        const email = searchParams.get('email')?.toLowerCase().trim();

        if (!token || !email) {
            return NextResponse.redirect(new URL('/login?error=Invalid link parameters', req.url));
        }

        const adminSupabase = createAdminSupabaseClient();

        // 1. Check if user is ALREADY verified 
        // (Handles cases where mobile apps background-click the link first)
        const { data: existingProfile } = await adminSupabase
            .from('profiles')
            .select('email_verified')
            .eq('email', email)
            .maybeSingle();

        if (existingProfile?.email_verified) {
            // Token already consumed but user is safe. Just cleanup and redirect.
            await adminSupabase.from('verification_tokens').delete().eq('identifier', email);
            return NextResponse.redirect(new URL('/login?success=Email already verified! Please login.', req.url));
        }

        // 2. Check if token is valid
        const { data: record, error: dbError } = await adminSupabase
            .from('verification_tokens')
            .select('*')
            .eq('identifier', email)
            .eq('token', token)
            .maybeSingle();

        if (dbError || !record) {
            console.error('Verify error or missing record:', dbError);
            return NextResponse.redirect(new URL('/login?error=Verification link invalid or already used', req.url));
        }

        // 3. Expiry Check with 5-min buffer for clock skew
        const expiryDate = new Date(record.expires);
        const now = new Date();
        const bufferMs = 5 * 60 * 1000; // 5 minute "juggad" buffer

        if (expiryDate.getTime() + bufferMs < now.getTime()) {
            await adminSupabase.from('verification_tokens').delete().eq('token', token);
            return NextResponse.redirect(new URL('/login?error=Link expired. Please request a new one.', req.url));
        }

        // 2. Verified! Handle Profile Creation or Update
        const metadata = record.metadata;

        if (metadata) {
            // SIGNUP FLOW: Create Profile now
            const userId = await emailToUUID(email);
            // Password is already hashed in send-verification route
            const hashedPassword = metadata.password;

            const { error: insertError } = await adminSupabase
                .from('profiles')
                .insert({
                    id: userId,
                    email: email,
                    username: email.split('@')[0] + Math.floor(Math.random() * 1000),
                    full_name: metadata.fullName || email.split('@')[0],
                    role: 'citizen', // SECURITY: Always hardcode — never trust metadata
                    password_hash: hashedPassword,
                    email_verified: new Date().toISOString(),
                    is_onboarded: false,
                    avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(metadata.fullName || email)}`,
                });

            if (insertError) {
                console.error('Verify Signup Insert Error:', insertError);
                return NextResponse.redirect(new URL(`/login?error=Failed to create account: ${insertError.message}`, req.url));
            }
        } else {
            // LOGIN FLOW: Just update timestamp
            const { error: updateError } = await adminSupabase
                .from('profiles')
                .update({ email_verified: new Date().toISOString() })
                .eq('email', email);

            if (updateError) {
                console.error('Update Profile Verified Error:', updateError);
                return NextResponse.redirect(new URL('/login?error=Account verification failed internally', req.url));
            }
        }

        // 3. Cleanup Token and Success!
        await adminSupabase.from('verification_tokens').delete().eq('token', token);
        return NextResponse.redirect(new URL('/login?success=Email verified successfully! You can now login.', req.url));

    } catch (error: any) {
        console.error('Verify Link Handler Error:', error);
        return NextResponse.redirect(new URL('/login?error=Server error during verification', req.url));
    }
}
