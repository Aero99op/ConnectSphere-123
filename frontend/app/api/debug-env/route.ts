import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    try {
        const envNames = Object.keys(process.env);
        const hasCrypto = typeof crypto !== 'undefined';
        const hasSubtle = hasCrypto && !!crypto.subtle;
        
        return NextResponse.json({
            status: "ok",
            runtime: "edge",
            envCount: envNames.length,
            envNames: envNames.filter(n => !n.includes('SECRET') && !n.includes('KEY')), // Security: only names
            crypto: {
                available: hasCrypto,
                subtle: hasSubtle
            },
            node_version: process.version || "not-node"
        });
    } catch (e: any) {
        return NextResponse.json({
            status: "error",
            message: e.message,
            stack: e.stack
        }, { status: 500 });
    }
}
