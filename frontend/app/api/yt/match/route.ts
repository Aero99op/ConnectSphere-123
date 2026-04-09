import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * InnerTube YouTube Music Matcher (Stable Core)
 */
async function matchYouTube(query: string) {
    const url = `https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30`;
    
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
        signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) throw new Error(`InnerTube failed: ${res.status}`);

    const data = await res.json();
    const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    for (const section of sections) {
        const items = section.musicShelfRenderer?.contents || [];
        for (const item of items) {
            const renderer = item.musicResponsiveListItemRenderer;
            if (!renderer) continue;

            const videoId = renderer.playlistItemData?.videoId || 
                           renderer.navigationEndpoint?.watchEndpoint?.videoId ||
                           renderer.doubleTapCommand?.watchEndpoint?.videoId;

            if (!videoId) continue;

            const columns = renderer.flexColumns || [];
            const column1Runs = columns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            
            let durationSeconds = 180;
            const durationText = column1Runs[column1Runs.length - 1]?.text;
            if (durationText && durationText.includes(":")) {
                const parts = durationText.split(":").map(Number);
                if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
                else if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }

            // Return the first valid match (the top result)
            return {
                id: videoId,
                duration: durationSeconds
            };
        }
    }
    return null;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    try {
        const match = await matchYouTube(query);
        if (match) {
            return NextResponse.json(match);
        }
        return NextResponse.json({ error: "No match found" }, { status: 404 });
    } catch (e) {
        return NextResponse.json({ error: "Match failed" }, { status: 502 });
    }
}
