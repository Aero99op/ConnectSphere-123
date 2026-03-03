import { NextRequest, NextResponse } from 'next/server';
import { getApinatorServer } from '@/lib/apinator-server';

// POST /api/apinator/auth
// Authenticates private and presence channel subscriptions
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { socket_id, channel_name } = body;

        if (!socket_id || !channel_name) {
            return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
        }

        const server = getApinatorServer();
        const auth = server.authenticateChannel(socket_id, channel_name);

        return NextResponse.json(auth);
    } catch (error) {
        console.error('[Apinator Auth] Error:', error);
        return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
    }
}
