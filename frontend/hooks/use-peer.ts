"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Peer, { DataConnection } from "peerjs";
import { supabase } from "@/lib/supabase";

/**
 * 📡 Gareeb-Pro Signaling (WebRTC)
 * Uses PeerJS for direct signaling to save Supabase Realtime limits.
 */
export function usePeer() {
    const [peer, setPeer] = useState<Peer | null>(null);
    const [myId, setMyId] = useState<string | null>(null);
    const [connections, setConnections] = useState<Record<string, DataConnection>>({});
    const [incomingSignal, setIncomingSignal] = useState<{ type: string; payload: any } | null>(null);
    const peerRef = useRef<Peer | null>(null);

    useEffect(() => {
        let isMounted = true;

        const initPeer = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !isMounted) return;

            // Use the User's Supabase ID as the Peer ID
            const newPeer = new Peer(user.id, {
                debug: 1 // Minimal logging
            });

            newPeer.on('open', (id: string) => {
                console.log('Peer connected with ID:', id);
                if (isMounted) {
                    setMyId(id);
                    setPeer(newPeer);
                    peerRef.current = newPeer;
                }
            });

            newPeer.on('connection', (conn: DataConnection) => {
                conn.on('data', (data: any) => {
                    console.log('Incoming Signal:', data);
                    if (isMounted) setIncomingSignal(data);
                });
            });

            newPeer.on('error', (err: any) => {
                console.error('Peer error:', err);
            });
        };

        if (typeof window !== "undefined") {
            initPeer();
        }

        return () => {
            isMounted = false;
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, []);

    const sendSignal = useCallback((recipientId: string, type: string, payload: any) => {
        if (!peerRef.current || !recipientId) return;

        // Try to reuse existing connection or create a new one
        const conn = peerRef.current.connect(recipientId);

        conn.on('open', () => {
            conn.send({ type, payload });
            // Close after sending to save browser resources
            setTimeout(() => conn.close(), 1000);
        });

        conn.on('error', (err: any) => {
            console.error('Signal Error:', err);
        });
    }, []);

    return {
        myId,
        incomingSignal,
        sendSignal,
        clearSignal: () => setIncomingSignal(null)
    };
}
