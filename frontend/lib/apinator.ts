// Apinator.io - Free Unlimited WebSocket Service
// Client-side: connects via WebSocket for realtime features
// Server-side: triggers events from API routes

// ============ CLIENT-SIDE ============
import { Apinator } from '@apinator/client';

let apinatorClient: any = null;

export function getApinatorClient() {
    if (typeof window === 'undefined') return null;

    if (!apinatorClient) {
        apinatorClient = new Apinator({
            appKey: process.env.NEXT_PUBLIC_APINATOR_KEY || '',
            cluster: process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'us',
            authEndpoint: '/api/apinator/auth',
        });
        apinatorClient.connect();
        console.log("[Apinator] Client connected!");
    }

    return apinatorClient;
}

export function disconnectApinator() {
    if (apinatorClient) {
        apinatorClient.disconnect();
        apinatorClient = null;
    }
}
