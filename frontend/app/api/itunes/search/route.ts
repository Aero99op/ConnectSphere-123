import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    try {
        const encoded = encodeURIComponent(query.trim());
        const targetUrl = `https://itunes.apple.com/search?term=${encoded}&media=music&entity=song&limit=25`;
        
        const res = await fetch(targetUrl, {
            headers: {
                "User-Agent": "ConnectSphere-Elite/1.0",
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!res.ok) {
            throw new Error(`iTunes responded with ${res.status}`);
        }

        const data = await res.json();
        const tracks = (data.results || [])
            .filter((t: any) => t.previewUrl)
            .map((t: any) => ({
                id: String(t.trackId),
                name: t.trackName,
                artist: t.artistName,
                artwork: t.artworkUrl100?.replace("100x100", "400x400"),
                url: t.previewUrl,
                duration: 30, // iTunes provides 30s previews only
                source: "itunes",
            }));

        return NextResponse.json(tracks, {
            headers: {
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
            },
        });
    } catch (e) {
        console.error("iTunes proxy error:", e);
        return NextResponse.json({ error: "iTunes search failed" }, { status: 502 });
    }
}
