"use client";

import { useEffect, useState, useRef } from "react";

/**
 * useTabSync
 * 
 * Ensures that only the active tab maintains a Realtime connection.
 * Uses BroadcastChannel to coordinate between tabs.
 */
export function useTabSync() {
    const [isLeader, setIsLeader] = useState(true); // Default to true so everything works immediately
    const channelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const channel = new BroadcastChannel("cs-tab-sync");
        channelRef.current = channel;

        const id = Math.random().toString(36).substring(7);

        const claimLeadership = () => {
            if (document.visibilityState === "visible") {
                setIsLeader(true);
                channel.postMessage({ type: "CLAIM_LEADERSHIP", id });
            }
        };

        const handleMessage = (event: MessageEvent) => {
            const { type, id: senderId } = event.data;

            if (type === "CLAIM_LEADERSHIP" && senderId !== id) {
                // Another tab claimed, we yield
                setIsLeader(false);
            } else if (type === "REPLY_LEADERSHIP" && senderId !== id) {
                if (document.visibilityState !== "visible") {
                    setIsLeader(false);
                }
            } else if (type === "POLL_LEADER") {
                if (document.visibilityState === "visible") {
                    channel.postMessage({ type: "REPLY_LEADERSHIP", id });
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                claimLeadership();
            } else {
                channel.postMessage({ type: "POLL_LEADER" });
            }
        };

        channel.onmessage = handleMessage;
        window.addEventListener("visibilitychange", handleVisibilityChange);

        // Initial claim
        if (document.visibilityState === "visible") {
            claimLeadership();
        }

        return () => {
            channel.close();
            window.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return { isLeader };
}
