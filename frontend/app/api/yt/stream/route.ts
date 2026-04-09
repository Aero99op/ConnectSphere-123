import { NextResponse } from "next/server";

export const runtime = "edge";
const INVIDIOUS_INSTANCES = [
    "https://inv.thepixora.com",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://yt.chocolatemoo53.com",
    "https://iv.ggtyler.dev"
];

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const preferredInstance = searchParams.get("instance");

    if (!id) {
        return new NextResponse("Missing video id", { status: 400 });
    }

    // Create a list of instances to try, starting with the preferred one
    const instancesToTry = preferredInstance 
        ? [preferredInstance, ...INVIDIOUS_INSTANCES.filter(i => i !== preferredInstance)]
        : INVIDIOUS_INSTANCES;

    for (const instance of instancesToTry) {
        try {
            const targetUrl = `${instance}/latest_version?id=${id}&itag=140`;
            
            const res = await fetch(targetUrl, {
                headers: {
                    'Range': req.headers.get('Range') || 'bytes=0-'
                },
                signal: AbortSignal.timeout(5000) // Don't hang forever
            });

            if (!res.ok) {
                console.warn(`Stream failed for ${instance}, status: ${res.status}`);
                continue;
            }

            // Successful connected to a stream: Boost headers for Parallel Turbo Engine
            const responseHeaders = new Headers(res.headers);
            responseHeaders.set('Access-Control-Allow-Origin', '*');
            responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            responseHeaders.set('Access-Control-Allow-Headers', 'Range');
            responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
            responseHeaders.set('Accept-Ranges', 'bytes');
            
            // GLOBAL EDGE CACHING: If any user plays it, everyone gets it instantly from Cloudflare Edge
            responseHeaders.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable'); 

            return new NextResponse(res.body, {
                status: res.status,
                headers: responseHeaders
            });
        } catch (e) {
            console.warn(`Stream unreachable for ${instance}:`, e);
            continue;
        }
    }

    return new NextResponse("Saare audio servers ki gaand phat gayi hai!", { status: 502 });
}
