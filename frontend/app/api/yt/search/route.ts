import { NextResponse } from "next/server";

export const runtime = "edge";

// Surgical Selection of Healthy Invidious Instances
const INVIDIOUS_INSTANCES = [
    "https://invidious.projectsegfau.lt",
    "https://yewtu.be",
    "https://invidious.nerdvpn.de",
    "https://inv.tux.im",
    "https://invidious.snopyta.org",
    "https://invidious.flokinet.to",
    "https://invidious.sethforprivacy.com"
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
                signal: AbortSignal.timeout(5000), // Slightly more generous for Edge
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            // If instance returns 401, 302, 404 etc., we skip to next one
            if (!res.ok || res.status === 302) {
                console.warn(`Bhai, ${instance} ne aukat dikha di (Status: ${res.status}). Agle pe jaa raha hoon...`);
                continue;
            }

            const data = await res.json();
            
            // Validate data structure
            if (!Array.isArray(data)) {
                 console.warn(`Bhai, ${instance} ne galat maal diya. Agle pe jaa raha hoon...`);
                 continue;
            }

            const tracks = data.slice(0, 25).map((v: any) => ({
                id: v.videoId,
                name: v.title,
                artist: v.author,
                artwork: v.videoThumbnails?.find((t: any) => t.quality === "high")?.url || v.videoThumbnails?.[0]?.url,
                // Point to our local stream proxy for 100% CORS safety
                url: `/api/yt/stream?id=${v.videoId}&instance=${encodeURIComponent(instance)}`,
                duration: v.lengthSeconds || 180,
                source: "youtube",
            }));

            // Track instance health for debugging (footprint)
            const successfulInstance = instance;
            
            // Rotate index for fairness in next call
            currentIdx = (currentIdx + 1) % INVIDIOUS_INSTANCES.length;
            
            return NextResponse.json(tracks, {
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
                    'X-Invidious-Instance': successfulInstance.split('//')[1]
                }
            });
        } catch (e) {
            console.error(`Bhai, ${instance} dead hai. Agle pe...`);
            continue;
        }
    }

    return NextResponse.json({ error: "Saare YouTube servers ki gaand phat gayi hai, later aao!" }, { status: 503 });
}
