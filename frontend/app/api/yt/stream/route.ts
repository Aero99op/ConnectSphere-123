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
                signal: AbortSignal.timeout(8000) // Give Invidious more time
            });

            if (!res.ok) {
                console.warn(`Stream failed for ${instance}, status: ${res.status}`);
                continue;
            }

            // Ensure proper CORS and Range headers for native HTML5 audio
            const responseHeaders = new Headers(res.headers);
            responseHeaders.set('Access-Control-Allow-Origin', '*');
            responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
            responseHeaders.set('Cache-Control', 'public, max-age=86400'); 

            return new NextResponse(res.body, {
                status: res.status,
                headers: responseHeaders
            });
        } catch (e) {
            console.warn(`Stream unreachable for ${instance}:`, e);
            continue;
        }
    }

    // Fallback to youtube directly if all proxies crash
    return NextResponse.redirect(`https://music.youtube.com/watch?v=${id}`);
}
