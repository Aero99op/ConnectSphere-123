import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/auth';

export const runtime = 'edge';

// SECURITY: Cryptographically secure OTP generation (CRIT-002 + HIGH-001 FIX)
function generateOTP() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (100000 + (arr[0] % 900000)).toString();
}

export async function POST(req: Request) {
    try {
        const { email, action } = await req.json();

        if (!email || !action) {
            return NextResponse.json({ error: 'Email and action are required' }, { status: 400 });
        }

        const adminSupabase = createAdminSupabaseClient();

        // SECURITY: Rate limit — max 3 OTP requests per email per 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { count, error: countError } = await adminSupabase
            .from('auth_otps')
            .select('*', { count: 'exact', head: true })
            .eq('email', email)
            .gte('created_at', tenMinutesAgo);

        if (!countError && (count ?? 0) >= 3) {
            return NextResponse.json({
                error: 'Bahut zyada OTP request ho gaye. 10 minute baad try karo.'
            }, { status: 429 });
        }

        // Remove old OTPs for this email to prevent spam issues
        await adminSupabase.from('auth_otps').delete().eq('email', email);

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        const { error: dbError } = await adminSupabase
            .from('auth_otps')
            .insert({
                email,
                otp,
                action,
                expires_at: expiresAt
            });

        if (dbError) {
            console.error('OTP DB Error:', dbError);
            return NextResponse.json({ error: 'Database error saving OTP' }, { status: 500 });
        }

        // Send via Cloudflare MailChannels (Free & Unlimited, Requires domain on CF)
        const mailchannelsData = {
            personalizations: [
                {
                    to: [{ email, name: email.split('@')[0] }]
                }
            ],
            from: {
                email: 'no-reply@connectsphere-123.pages.dev',
                name: 'ConnectSphere Auth'
            },
            subject: `Your ${action === 'signup' ? 'Sign Up' : 'Login'} OTP - ConnectSphere`,
            content: [
                {
                    type: 'text/html',
                    value: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #000; color: #fff; border-radius: 10px;">
                            <h2 style="color: #4ade80;">ConnectSphere Authentication</h2>
                            <p style="font-size: 16px;">Here is your verification code to continue.</p>
                            <h1 style="font-size: 32px; letter-spacing: 5px; color: #fff; background: #222; padding: 10px; border-radius: 5px; display: inline-block;">${otp}</h1>
                            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">This code expires in 10 minutes. Do not share it with anyone.</p>
                        </div>
                    `
                }
            ]
        };

        const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(mailchannelsData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('MailChannels Error:', errorText);

            // As a massive juggad for local dev, if MailChannels fails (because we aren't on CF yet),
            // We just return success anyway, and print the OTP in the server console for the dev!
            if (process.env.NODE_ENV === 'development') {
                console.log(`\n\n🚨 DEV MODE OTP FOR ${email}: ${otp} 🚨\n\n`);
                return NextResponse.json({ message: 'OTP stored. Check console for local dev.' });
            }

            return NextResponse.json({
                error: 'Failed to send email via MailChannels',
                details: errorText
            }, { status: 500 });
        }

        // For local development, still log it for convenience
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n\n✅ OTP SENT TO ${email}: ${otp} ✅\n\n`);
        }

        return NextResponse.json({ message: 'OTP sent successfully' });

    } catch (error: any) {
        // SECURITY: Log full error server-side, return generic message to client
        console.error('Send OTP Handler Error Full:', error?.message, error?.stack);

        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}
