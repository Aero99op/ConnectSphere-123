// Apinator Edge-Compatible Server Implementation
// Reverse-engineered from @apinator/server SDK to work on Cloudflare Edge Runtime
// (avoiding Node.js 'crypto' module by using Web Crypto API)

// --- Edge-compatible MD5 (needed for body_md5 in request signing) ---
function md5Hex(str: string): string {
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
    const enc = new TextEncoder();
    const s = enc.encode(str);
    const l = s.length;
    const blocks = new Uint32Array((((l + 9) >> 6) + 1) << 4);
    for (let i = 0; i < l; i++) blocks[i >> 2] |= s[i] << ((i % 4) << 3);
    blocks[l >> 2] |= 0x80 << ((l % 4) << 3);
    blocks[blocks.length - 2] = l << 3;
    for (let i = 0; i < blocks.length; i += 16) {
        let [a, c, d, e] = h;
        for (let j = 0; j < 64; j++) {
            let f: number, g: number;
            if (j < 16) { f = (c & d) | (~c & e); g = j; }
            else if (j < 32) { f = (c & e) | (d & ~e); g = (5 * j + 1) % 16; }
            else if (j < 48) { f = c ^ d ^ e; g = (3 * j + 5) % 16; }
            else { f = d ^ (c | ~e); g = (7 * j) % 16; }
            const tmp = e; e = d; d = c;
            const sum = (a + f + k[j] + blocks[i + g]) | 0;
            c = (c + ((sum << r[j]) | (sum >>> (32 - r[j])))) | 0;
            a = tmp;
        }
        h[0] = (h[0] + a) | 0; h[1] = (h[1] + c) | 0;
        h[2] = (h[2] + d) | 0; h[3] = (h[3] + e) | 0;
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')
        .match(/../g)!.reverse().join('')).join('');
}

// --- Edge-compatible HMAC-SHA256 ---
async function hmacSha256(secret: string, message: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Apinator request signing (matches SDK exactly) ---
// SDK format: signString = `${timestamp}\n${method}\n${path}\n${bodyMD5}`
async function signRequest(secret: string, method: string, path: string, body: string, timestamp: number): Promise<string> {
    const bodyMD5 = body === '' ? '' : md5Hex(body);
    const sigString = `${timestamp}\n${method}\n${path}\n${bodyMD5}`;
    return hmacSha256(secret, sigString);
}

// --- Apinator channel signing (matches SDK exactly) ---
// SDK format: sigString = `${socketId}:${channelName}` or `${socketId}:${channelName}:${channelData}`
async function signChannel(secret: string, socketId: string, channelName: string, channelData?: string): Promise<string> {
    const sigString = channelData ? `${socketId}:${channelName}:${channelData}` : `${socketId}:${channelName}`;
    return hmacSha256(secret, sigString);
}

// --- Main export ---
export const getApinatorServer = () => {
    const appId = process.env.APINATOR_APP_ID || '';
    const appKey = process.env.APINATOR_KEY || '';
    const appSecret = process.env.APINATOR_SECRET || '';
    const cluster = process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'us';
    // SDK uses: `https://ws-${cluster}.apinator.io`
    const host = `https://ws-${cluster}.apinator.io`;

    return {
        trigger: async ({ channel, name: eventName, data }: { channel: string; name: string; data: any }) => {
            const body: any = {
                name: eventName,
                data: typeof data === 'string' ? data : JSON.stringify(data),
            };
            // SDK uses 'channel' for single, 'channels' for array
            if (Array.isArray(channel)) {
                body.channels = channel;
            } else {
                body.channel = channel;
            }

            const bodyString = JSON.stringify(body);
            const path = `/apps/${appId}/events`;
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = await signRequest(appSecret, 'POST', path, bodyString, timestamp);

            // SDK uses these exact headers:
            const response = await fetch(`${host}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Realtime-Key': appKey,
                    'X-Realtime-Timestamp': timestamp.toString(),
                    'X-Realtime-Signature': signature,
                },
                body: bodyString,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Apinator] Trigger failed:', response.status, errorText);
                throw new Error(`Apinator trigger failed (${response.status}): ${errorText}`);
            }

            const text = await response.text();
            return text === '' ? {} : JSON.parse(text);
        },

        authenticateChannel: async (socketId: string, channelName: string, channelData?: string) => {
            const signature = await signChannel(appSecret, socketId, channelName, channelData);
            const result: any = { auth: `${appKey}:${signature}` };
            if (channelData !== undefined) {
                result.channel_data = channelData;
            }
            return result;
        },
    };
};
