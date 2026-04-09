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
        // ULTIMATE FAST-PATH: Use native InnerTube IOS API which skips signature ciphers and gives naked CDN URLs
        const response = await fetch(`https://music.youtube.com/youtubei/v1/player?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.ios.youtube/19.43.2 (iPhone14,3; U; CPU iOS 15_6_1 like Mac OS X; en_US)',
                'Origin': 'https://music.youtube.com'
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'IOS',
                        clientVersion: '19.43.2',
                        hl: 'en',
                        gl: 'US'
                    }
                },
                videoId: id
            }),
            signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
            const data = await response.json();
            const formats = data.streamingData?.adaptiveFormats || [];
            // Get best m4a/opus audio
            const stream = formats.find((f: any) => f.mimeType?.includes('audio/mp4')) || formats[0];

            if (stream && stream.url) {
                // Direct jump to Google CDN. Instagram Speed Achieved!
                return NextResponse.redirect(stream.url);
            }
        }
    } catch (e) {
        console.warn(`InnerTube Stream API failed:`, e);
    }

    // Fallback 1: Piped API
    try {
        const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${id}`, {
            signal: AbortSignal.timeout(3000)
        });
        if (pipedRes.ok) {
            const data = await pipedRes.json();
            const m4aStream = data.audioStreams?.find((s: any) => s.mimeType?.includes('audio/mp4') || s.format === 'M4A') || data.audioStreams?.[0];
            if (m4aStream && m4aStream.url) return NextResponse.redirect(m4aStream.url);
        }
    } catch (e) { }

    // Fallback 2: Direct raw proxy URL
    return NextResponse.redirect(`https://inv.thepixora.com/latest_version?id=${id}&itag=140`);
}
