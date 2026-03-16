export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// GET /api/ice-servers — Returns WebRTC ICE server configuration
// SECURITY FIX (HIGH-05): ICE servers are no longer hardcoded in client JS.
// Supports TURN servers via environment variables for IP privacy.
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Base STUN servers (free, always available)
        const iceServers: RTCIceServer[] = [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
        ];

        // TURN server support via environment variables
        // Set TURN_SERVER_URL, TURN_USERNAME, TURN_PASSWORD in Cloudflare env
        // Free TURN options: Metered.ca free tier, Open Relay Project
        const turnUrl = process.env.TURN_SERVER_URL;
        const turnUsername = process.env.TURN_USERNAME;
        const turnPassword = process.env.TURN_PASSWORD;

        if (turnUrl && turnUsername && turnPassword) {
            iceServers.push({
                urls: turnUrl,
                username: turnUsername,
                credential: turnPassword,
            });
        }

        return NextResponse.json({ iceServers }, {
            headers: {
                // Short cache to allow credential rotation
                'Cache-Control': 'private, max-age=300',
            }
        });
    } catch (error) {
        console.error('[ICE Servers] Error:', error);
        return NextResponse.json({ error: 'Failed to get ICE servers' }, { status: 500 });
    }
}
