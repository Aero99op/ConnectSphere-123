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

    if (!id) {
        return new NextResponse("Missing video id", { status: 400 });
    }

    try {
        const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${id}`, {
            signal: AbortSignal.timeout(5000),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (pipedRes.ok) {
            const data = await pipedRes.json();
            // Find format 140 (m4a) which is standard across all platforms and extremely fast
            const m4aStream = data.audioStreams?.find((s: any) => s.mimeType?.includes('audio/mp4') || s.format === 'M4A') 
                           || data.audioStreams?.[0]; // Fallback to first available

            if (m4aStream && m4aStream.url) {
                // Direct redirect to Google's CDN! Instant load, handles Range natively.
                return NextResponse.redirect(m4aStream.url);
            }
        }
    } catch (e) {
        console.warn(`Piped API failed:`, e);
    }

    // Fallback: If Piped fails, try the first Invidious instance as a raw proxy redirect
    return NextResponse.redirect(`https://inv.thepixora.com/latest_version?id=${id}&itag=140`);
}
