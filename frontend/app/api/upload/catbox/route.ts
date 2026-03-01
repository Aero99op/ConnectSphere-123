import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();

        const response = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: formData,
            headers: {
                // Catbox requires a User-Agent sometimes to prevent scraping/bots blocking
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Catbox Upload Failed: ${response.statusText}` },
                { status: response.status }
            );
        }

        const url = await response.text();
        return NextResponse.json({ url });
    } catch (error: any) {
        console.error("Error in catbox proxy:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
