// Apinator Server SDK - for triggering events from API routes
import { Apinator } from '@apinator/server';

let serverClient: any = null;

export function getApinatorServer() {
    if (!serverClient) {
        serverClient = new Apinator({
            appId: process.env.APINATOR_APP_ID || '',
            key: process.env.APINATOR_KEY || '',
            secret: process.env.APINATOR_SECRET || '',
            cluster: process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'us',
        });
    }
    return serverClient;
}
