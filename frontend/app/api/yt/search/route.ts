import { NextResponse } from "next/server";

export const runtime = "edge";

const INVIDIOUS_INSTANCES = [
    "https://invidious.projectsegfau.lt",
    "https://yewtu.be",
    "https://invidious.nerdvpn.de",
    "https://invidious.snopyta.org"
];

let currentIdx = 0;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    // Surgical Retry Loop across instances (Server-Side)
    for (let i = 0; i < INVIDIOUS_INSTANCES.length; i++) {
        const instance = INVIDIOUS_INSTANCES[(currentIdx + i) % INVIDIOUS_INSTANCES.length];
        try {
            const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
                signal: AbortSignal.timeout(4000) // Fast fail-over
            });

            if (!res.ok) continue;

            const data = await res.json();
            const tracks = (data || []).slice(0, 20).map((v: any) => ({
                id: v.videoId,
                name: v.title,
                artist: v.author,
                artwork: v.videoThumbnails?.find((t: any) => t.quality === "high")?.url || v.videoThumbnails?.[0]?.url,
                // Point to our local stream proxy for 100% CORS safety
                url: `/api/yt/stream?id=${v.videoId}&instance=${encodeURIComponent(instance)}`,
                duration: v.lengthSeconds || 180,
                source: "youtube",
            }));

            // If we found results, we stay on this instance for the next request but rotate index for fairness
            currentIdx = (currentIdx + 1) % INVIDIOUS_INSTANCES.length;
            
            return NextResponse.json(tracks, {
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800'
                }
            });
        } catch (e) {
            console.error(`Bhai, ${instance} fail ho gaya, agle pe jaa raha hoon...`);
            continue;
        }
    }

    return NextResponse.json({ error: "Saare YouTube servers ki gaand phat gayi hai, baad me aao!" }, { status: 503 });
}
