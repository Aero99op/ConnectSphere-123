// Apinator Edge-Compatible Implementation (Pusher-compatible API)

// Lightweight MD5 for 'body_md5' - Needed for Pusher-compatible API
function md5(str: string) {
    const k = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ];
    const r = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];
    let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
    const encoder = new TextEncoder();
    const s = encoder.encode(str);
    const l = s.length;
    const b = new Uint32Array(((l + 9) >> 6) + 1 << 4);
    for (let i = 0; i < l; i++) b[i >> 2] |= s[i] << ((i % 4) << 3);
    b[l >> 2] |= 0x80 << ((l % 4) << 3);
    b[b.length - 2] = l << 3;
    for (let i = 0; i < b.length; i += 16) {
        let [a, c, d, e] = h;
        for (let j = 0; j < 64; j++) {
            let f, g;
            if (j < 16) { f = (c & d) | (~c & e); g = j; }
            else if (j < 32) { f = (c & e) | (d & ~e); g = (5 * j + 1) % 16; }
            else if (j < 48) { f = c ^ d ^ e; g = (3 * j + 5) % 16; }
            else { f = d ^ (c | ~e); g = (7 * j) % 16; }
            const t = e; e = d; d = c;
            c = (c + ((a + f + k[j] + b[i + g]) << r[j] | (a + f + k[j] + b[i + g]) >>> (32 - r[j]))) | 0;
            a = t;
        }
        h[0] = (h[0] + a) | 0; h[1] = (h[1] + c) | 0; h[2] = (h[2] + d) | 0; h[3] = (h[3] + e) | 0;
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0').match(/../g)!.reverse().join('')).join('');
}

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
        trigger: async ({ channel, name: eventName, data }: { channel: string, name: string, data: any }) => {
            const path = `/apps/${appId}/events`;
            const body = JSON.stringify({
                name: eventName,
                channels: Array.isArray(channel) ? channel : [channel],
                data: typeof data === 'string' ? data : JSON.stringify(data)
            });

            const body_md5 = md5(body);
            const auth_timestamp = Math.floor(Date.now() / 1000);
            const auth_version = '1.0';

            const params = {
                auth_key: appKey,
                auth_timestamp,
                auth_version,
                body_md5
            };

            const sortedQuery = Object.keys(params)
                .sort()
                .map(k => `${k}=${(params as any)[k]}`)
                .join('&');

            const stringToSign = `POST\n${path}\n${sortedQuery}`;
            const auth_signature = await sign(stringToSign, appSecret);

            const url = `${host}${path}?${sortedQuery}&auth_signature=${auth_signature}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[Apinator] Trigger failed:", errorText);
                throw new Error(`Apinator Trigger failed: ${errorText}`);
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
