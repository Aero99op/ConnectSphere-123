"use client";

import { useEffect, useState, useRef } from "react";

/**
 * useTabSync - "Last Claimant Wins" Model
 * 
 * Ensures that only ONE tab maintains a Realtime connection.
 * Uses BroadcastChannel for inter-tab coordination.
 * Rule: The most recently focused/opened tab becomes the leader.
 *       All other tabs yield immediately.
 */
export function useTabSync() {
    const [isLeader, setIsLeader] = useState(false);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const isLeaderRef = useRef(false); // Ref to track leadership in closures

    useEffect(() => {
        if (typeof window === "undefined") return;

        const channel = new BroadcastChannel("cs-tab-sync");
        channelRef.current = channel;

        const id = Math.random().toString(36).substring(7);
        console.log("[TabSync] Tab initialized:", id);

        const becomeLeader = () => {
            console.log("[TabSync] ✅ I am the LEADER:", id);
            isLeaderRef.current = true;
            setIsLeader(true);
        };

        const yieldLeadership = () => {
            if (isLeaderRef.current) {
                console.log("[TabSync] ❌ Yielding leadership:", id);
            }
            isLeaderRef.current = false;
            setIsLeader(false);
        };

        const claimLeadership = () => {
            console.log("[TabSync] Claiming leadership for tab", id);
            becomeLeader();
            channel.postMessage({ type: "CLAIM_LEADERSHIP", id });
        };

        const handleMessage = (event: MessageEvent) => {
            const { type, id: senderId } = event.data;

            if (type === "CLAIM_LEADERSHIP" && senderId !== id) {
                // CRITICAL: Always yield to the newcomer. "Last Claimant Wins."
                console.log("[TabSync] Another tab claimed leadership:", senderId, "- I yield.");
                yieldLeadership();
            } else if (type === "POLL_LEADER") {
                // Someone is asking who the leader is
                if (isLeaderRef.current) {
                    channel.postMessage({ type: "REPLY_LEADERSHIP", id });
                }
            } else if (type === "REPLY_LEADERSHIP" && senderId !== id) {
                // A leader already exists, yield
                if (!isLeaderRef.current) return; // Already a follower
                // Edge case: two leaders. The one who receives the reply yields.
                yieldLeadership();
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // When tab becomes visible, claim leadership
                claimLeadership();
            }
            // When hidden, do nothing. We stay leader until someone else claims.
        };

        channel.onmessage = handleMessage;
        window.addEventListener("visibilitychange", handleVisibilityChange);

        // On mount: Poll to check if a leader already exists
        channel.postMessage({ type: "POLL_LEADER" });

        // Wait 300ms for a reply. If no one replies, we become leader.
        const initTimeout = setTimeout(() => {
            if (!isLeaderRef.current) {
                console.log("[TabSync] No existing leader found. Taking over.");
                claimLeadership();
            }
        }, 300);

        return () => {
            clearTimeout(initTimeout);
            channel.close();
            window.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return { isLeader };
}
