import { NextRequest, NextResponse } from 'next/server';
import { getApinatorServer } from '@/lib/apinator-server';

// POST /api/apinator/trigger
// Trigger an event on an Apinator channel from the server side
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { channel, event, data } = body;

        if (!channel || !event) {
            return NextResponse.json({ error: 'Missing channel or event' }, { status: 400 });
        }

        const server = getApinatorServer();
        await server.trigger({
            channel,
            name: event,
            data: typeof data === 'string' ? data : JSON.stringify(data),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Apinator Trigger] Error:', error);
        return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
    }
}
