import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/auth';
import crypto from 'crypto';

export const runtime = 'edge';

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

export async function POST(req: Request) {
    try {
        const { email, action, password, fullName, role } = await req.json();

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
        const metadata = action === 'signup' ? {
            password, // We'll hash it here for security OR just store it if we trust the channel
            fullName,
            role: role || 'citizen'
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
        // Using dynamic origin for local/prod compatibility
        const origin = req.headers.get('origin') || 'http://localhost:3000';
        const verifyLink = `${origin}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

        // 4. Send via Google Apps Script Proxy Cluster
        // Bhai, multiple URLs yaha comma-separated daal dena
        const proxyUrls = (process.env.GOOGLE_SCRIPT_URLS || "").split(',').filter(Boolean);

        if (proxyUrls.length === 0 && process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Google Script URLs are missing!' }, { status: 500 });
        }

        const emailContent = `
            <div style="font-family: sans-serif; padding: 20px; text-align: center; background: #000; color: #fff; border-radius: 15px; border: 1px solid #333;">
                <h2 style="color: #4ade80;">Verify Your ConnectSphere Account</h2>
                <p style="font-size: 16px; color: #ccc;">Bhai, account verify karne ke liye niche button pe click kar:</p>
                <div style="margin: 30px 0;">
                    <a href="${verifyLink}" style="background: #4ade80; color: #000; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px;">Verify Me 🚀</a>
                </div>
                <p style="font-size: 12px; color: #666;">Ye link 24 ghante mein expire ho jayega. Do not share it.</p>
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
