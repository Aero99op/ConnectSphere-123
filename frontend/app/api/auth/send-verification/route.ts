import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, hashPassword } from '@/lib/auth';
export const runtime = 'edge';

function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
    try {
        let { email, action, password, fullName } = await req.json();
        email = email?.toLowerCase().trim();

        if (!email || !action) {
            return NextResponse.json({ error: 'Email and action are required' }, { status: 400 });
        }

        const adminSupabase = createAdminSupabaseClient();

        // 0. If Signup, check if already exists
        if (action === 'signup') {
            const { data: existingUser } = await adminSupabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (existingUser) {
                return NextResponse.json({ error: 'Bhai, account pehle se hai! Login kar lo.' }, { status: 400 });
            }
        }

        const token = generateToken();
        const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

        // Store metadata for signup (Deferred creation)
        // SECURITY: Hash password before storing — never store plaintext
        const metadata = action === 'signup' ? {
            password: await hashPassword(password),
            fullName,
            role: 'citizen'
        } : null;

        // 1. Cleanup old tokens for this email
        await adminSupabase.from('verification_tokens').delete().eq('identifier', email);

        // 2. Insert new token
        const { error: dbError } = await adminSupabase
            .from('verification_tokens')
            .insert({
                identifier: email,
                token,
                expires,
                metadata
            });

        if (dbError) {
            console.error('Magic Link DB Error:', dbError);
            return NextResponse.json({ error: 'Database error saving token' }, { status: 500 });
        }

        // 3. Construct Magic Link
        // Fetch base URL from env OR fallback to origin header
        let baseUrl = process.env.NEXTAUTH_URL || req.headers.get('origin');

        // If still no baseUrl (should not happen on CF), fallback to the hardcoded prod URL
        if (!baseUrl) {
            baseUrl = 'https://connectsphere-123.pages.dev';
        }

        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        const verifyLink = `${baseUrl}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

        // 4. Send via Google Apps Script Proxy Cluster
        const proxyUrls = (process.env.GOOGLE_SCRIPT_URLS || "").split(',').filter(Boolean);

        if (proxyUrls.length === 0 && process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Google Script URLs are missing!' }, { status: 500 });
        }

        const emailContent = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; color: #1a1a1a; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="font-size: 28px; font-weight: 800; background: linear-gradient(to right, #4f46e5, #0891b2); -webkit-background-clip: text; color: #4f46e5; margin: 0; letter-spacing: -0.025em;">ConnectSphere</h1>
                </div>
                
                <h2 style="font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 16px; color: #111827;">Email Verification</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #4b5563; text-align: center; margin-bottom: 32px;">
                    Welcome to ConnectSphere! Verify your email to start building connections. Just click the button below to complete your setup.
                </p>
                
                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="${verifyLink}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 14px 32px; font-weight: 600; text-decoration: none; border-radius: 8px; transition: background-color 0.2s;">
                        Verify My Account 🚀
                    </a>
                </div>
                
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 32px;">
                    <p style="font-size: 14px; color: #6b7280; text-align: center; margin: 0;">
                        Or copy and paste this link in your browser: <br/>
                        <a href="${verifyLink}" style="color: #4f46e5; word-break: break-all;">${verifyLink}</a>
                    </p>
                </div>
                
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                    This link will expire in 2 hours for security reasons.<br/>
                    If you didn't request this email, you can safely ignore it.
                </p>
            </div>
        `;

        let sent = false;
        // Try each proxy if one fails
        for (const url of proxyUrls) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: email,
                        html: emailContent
                    })
                });

                if (res.ok) {
                    sent = true;
                    break;
                }
            } catch (err) {
                console.error(`Proxy ${url} failed, trying next...`);
            }
        }

        if (!sent && process.env.NODE_ENV === 'development') {
            console.log(`\n\n🚨 DEV MODE LINK FOR ${email}: ${verifyLink} 🚨\n\n`);
            return NextResponse.json({ message: 'Stored. Check console in local dev.' });
        }

        if (!sent) {
            return NextResponse.json({ error: 'Saare proxies fail ho gaye! Check GOOGLE_SCRIPT_URLS.' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Verification link sent to your email! ✨' });

    } catch (error: any) {
        console.error('Send Link Handler Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
