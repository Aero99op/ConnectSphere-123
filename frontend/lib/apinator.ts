// Apinator.io - Free Unlimited WebSocket Service
// Client-side: connects via WebSocket for realtime features
// Server-side: triggers events from API routes

// ============ CLIENT-SIDE ============
import { Apinator } from '@apinator/client';

let apinatorClient: any = null;

export function getApinatorClient() {
    if (typeof window === 'undefined') return null;

    if (!apinatorClient) {
        const appKey = process.env.NEXT_PUBLIC_APINATOR_KEY || '';
        const cluster = process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'us';

        if (!appKey) {
            console.error("[Apinator] ❌ NEXT_PUBLIC_APINATOR_KEY is EMPTY! Real-time features will NOT work.");
            return null;
        }

        apinatorClient = new Apinator({
            appKey,
            cluster,
            authEndpoint: '/api/apinator/auth',
        });

        // Connection state monitoring
        apinatorClient.bind('state_change', (states: any) => {
            console.log(`[Apinator] Connection state: ${states?.previous} → ${states?.current}`);
        });

        apinatorClient.bind('error', (err: any) => {
            console.error("[Apinator] ❌ Connection error:", err);
        });

        // NOTE: Do NOT call .connect() here. The ApinatorProvider handles connection.
        console.log(`[Apinator] Client created (not yet connected). Key: ${appKey.substring(0, 10)}... Cluster: ${cluster}`);
    }

    return apinatorClient;
}

export function disconnectApinator() {
    if (apinatorClient) {
        apinatorClient.disconnect();
        apinatorClient = null;
    }
}
