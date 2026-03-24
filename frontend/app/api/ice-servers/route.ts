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

        // Base STUN servers (free, always available) + Free TURN servers
        const iceServers: RTCIceServer[] = [
            // Multiple STUN servers for redundancy across carriers
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
            // Free Public TURN Server (Open Relay Project / metered.ca)
            // These fix calls on strict Mobile Data / CGNAT (Jio, Airtel, etc.)
            { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
            // Alternate free STUN for CGNAT environments
            { urls: "stun:stun.relay.metered.ca:80" },
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
