import { NextResponse } from "next/server";

export const runtime = "edge";

// Surgical Selection of Healthy Invidious Instances (Backup)
const INVIDIOUS_INSTANCES = [
    "https://inv.thepixora.com",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://yt.chocolatemoo53.com",
    "https://iv.ggtyler.dev"
];

let currentIdx = 0;

/**
 * InnerTube YouTube Music Search (Stable Core)
 */
async function searchInnerTube(query: string) {
    const url = `https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30`;
    
    // Modern InnerTube context for WEB_REMIX (YouTube Music)
    const payload = {
        context: {
            client: {
                clientName: "WEB_REMIX",
                clientVersion: "1.20231023.01.00",
                hl: "en",
                gl: "US"
            }
        },
        query: query
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": "https://music.youtube.com",
            "Referer": "https://music.youtube.com/search"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) throw new Error(`InnerTube failed: ${res.status}`);

    const data = await res.json();
    
    // Deep parsing of InnerTube's complex JSON
    const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const tracks: any[] = [];

    for (const section of sections) {
        const items = section.musicShelfRenderer?.contents || [];
        for (const item of items) {
            const renderer = item.musicResponsiveListItemRenderer;
            if (!renderer) continue;

            const videoId = renderer.playlistItemData?.videoId || 
                           renderer.navigationEndpoint?.watchEndpoint?.videoId ||
                           renderer.doubleTapCommand?.watchEndpoint?.videoId;

            if (!videoId) continue;

            // Extract metadata from flex columns
            const columns = renderer.flexColumns || [];
            
            // Column 0: Title
            const title = columns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            
            // Column 1: Artist, Album, Duration etc.
            const column1Runs = columns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            const artist = column1Runs[0]?.text || "Unknown Artist";
            
            // Duration is usually the last run in column 1 or in a separate field
            let durationSeconds = 180;
            const durationText = column1Runs[column1Runs.length - 1]?.text;
            if (durationText && durationText.includes(":")) {
                const parts = durationText.split(":").map(Number);
                if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
                else if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
            
            // Thumbnail extraction (get the highest quality)
            const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
            let artwork = thumbnails[thumbnails.length - 1]?.url;
            if (artwork && artwork.startsWith("//")) artwork = "https:" + artwork;

            tracks.push({
                id: videoId,
                name: title || "Unknown Track",
                artist: artist,
                artwork: artwork,
                url: `/api/yt/stream?id=${videoId}&instance=${encodeURIComponent(INVIDIOUS_INSTANCES[0])}`,
                duration: durationSeconds,
                source: "youtube",
            });
        }
    }

    return tracks;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    // Attempt 1: InnerTube (Stable)
    try {
        const tracks = await searchInnerTube(query);
        if (tracks.length > 0) {
            return NextResponse.json(tracks.slice(0, 25), {
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
                    'X-Source': 'InnerTube-Elite'
                }
            });
        }
    } catch (e) {
        console.warn("Bhai, InnerTube ne aukat dikha di. Invidious pe switch kar raha hoon...", e);
    }

    // Attempt 2: Invidious Proxy (Failover)
    for (let i = 0; i < INVIDIOUS_INSTANCES.length; i++) {
        const instance = INVIDIOUS_INSTANCES[(currentIdx + i) % INVIDIOUS_INSTANCES.length];
        try {
            const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
                signal: AbortSignal.timeout(3500),
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            if (!res.ok || res.status === 302) continue;

            const data = await res.json();
            if (!Array.isArray(data)) continue;

            const tracks = data.slice(0, 25).map((v: any) => ({
                id: v.videoId,
                name: v.title,
                artist: v.author,
                artwork: v.videoThumbnails?.find((t: any) => t.quality === "high")?.url || v.videoThumbnails?.[0]?.url,
                url: `/api/yt/stream?id=${v.videoId}&instance=${encodeURIComponent(instance)}`,
                duration: v.lengthSeconds || 180,
                source: "youtube",
            }));

            currentIdx = (currentIdx + 1) % INVIDIOUS_INSTANCES.length;
            
            return NextResponse.json(tracks, {
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
                    'X-Source': `Invidious-Failover-${instance.split('//')[1]}`
                }
            });
        } catch (e) {
            continue;
        }
    }

    return NextResponse.json({ error: "Saare YouTube servers ki gaand phat gayi hai, later aao!" }, { status: 503 });
}
