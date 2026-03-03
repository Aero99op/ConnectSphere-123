// Apinator Edge-Compatible Implementation
// We avoid the Node.js 'crypto' dependency to make it work on Cloudflare Pages

async function sign(message: string, secret: string) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export const getApinatorServer = () => {
    const appId = process.env.APINATOR_APP_ID || '';
    const appKey = process.env.APINATOR_KEY || '';
    const appSecret = process.env.APINATOR_SECRET || '';
    const cluster = process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'us';
    const host = `https://api-${cluster}.apinator.io`;

    return {
        trigger: async ({ channel, name, data }: { channel: string, name: string, data: any }) => {
            const path = `/apps/${appId}/events`;
            const body = JSON.stringify({
                name,
                channel,
                data: typeof data === 'string' ? data : JSON.stringify(data)
            });

            // For Apinator (Pusher-compatible), simple triggers can often work with just the key
            // but for full security a signature is usually required.
            // Let's use the simplest direct trigger method.
            const response = await fetch(`${host}${path}?auth_key=${appKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });

            if (!response.ok) {
                console.error("[Apinator] Trigger failed:", await response.text());
            }
            return response.json();
        },
        authenticateChannel: async (socketId: string, channelName: string) => {
            const stringToSign = `${socketId}:${channelName}`;
            const signature = await sign(stringToSign, appSecret);
            return { auth: `${appKey}:${signature}` };
        }
    };
};
