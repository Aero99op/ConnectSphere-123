"use client";

import { useEffect, useState, useRef } from "react";

/**
 * useTabSync
 * 
 * Ensures that only the active tab maintains a Realtime connection.
 * Uses BroadcastChannel to coordinate between tabs.
 */
export function useTabSync() {
    const [isLeader, setIsLeader] = useState(true); // Default to true to avoid initial delay
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
                // If another tab claims leadership and we are hidden, we yield
                if (document.visibilityState !== "visible") {
                    setIsLeader(false);
                } else {
                    // If we are also visible, the one who just claimed (the one who just became visible) wins
                    // No action needed for 'isLeader' as we'll yield if we ever become hidden
                }
            } else if (type === "REPLY_LEADERSHIP" && senderId !== id) {
                // If a leader replies, and we are hidden, we stay a follower
                if (document.visibilityState !== "visible") {
                    setIsLeader(false);
                }
            } else if (type === "POLL_LEADER") {
                if (isLeader && document.visibilityState === "visible") {
                    channel.postMessage({ type: "REPLY_LEADERSHIP", id });
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                claimLeadership();
            } else {
                // When we go into hiding, we check if others are around
                channel.postMessage({ type: "POLL_LEADER" });
            }
        };

        channel.onmessage = handleMessage;
        window.addEventListener("visibilitychange", handleVisibilityChange);

        // Initial check
        if (document.visibilityState === "visible") {
            claimLeadership();
        } else {
            channel.postMessage({ type: "POLL_LEADER" });
            // Small timeout to see if anyone replies
            setTimeout(() => {
                // If after 500ms no one replied, maybe we are the only tab?
                // For now, we allow background tabs to be leaders ONLY if no one else is visible.
            }, 500);
        }

        return () => {
            channel.close();
            window.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return { isLeader };
}
