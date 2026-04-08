import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const instance = searchParams.get("instance");

    if (!id || !instance) {
        return new NextResponse("Missing id or instance", { status: 400 });
    }

    try {
        const targetUrl = `${instance}/latest_version?id=${id}&itag=140`;
        
        // Surgical Proxy: Fetch the stream from the instance and pipe it back
        const res = await fetch(targetUrl, {
            headers: {
                'Range': req.headers.get('Range') || 'bytes=0-'
            }
        });

        if (!res.ok) throw new Error("Stream failed");

        // We return the actual audio stream with corrected headers
        return new NextResponse(res.body, {
            status: res.status,
            headers: {
                'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
                'Content-Length': res.headers.get('Content-Length') || '',
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
            }
        });
    } catch (e) {
        return new NextResponse("Stream unreachable", { status: 502 });
    }
}
