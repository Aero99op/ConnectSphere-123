"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { VideoCallWindow } from "./video-call-window";
import { GroupCallWindow } from "./group-call-window";
import { Phone, PhoneOff, Video, Users } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function CallManager() {
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [activeCall, setActiveCall] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const activeCallRef = useRef<any>(null);
    useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

    // 1. Manage User Auth State
    useEffect(() => {
        let isMounted = true;
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (isMounted) setUserId(session?.user?.id || null);
        };
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted) setUserId(session?.user?.id || null);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // 2. Manage Realtime Channel based on userId
    useEffect(() => {
        if (!userId) return;
        let isMounted = true;
        let channel: any;

        let heartbeat: NodeJS.Timeout;

        const setupChannel = () => {
            // Subscribe to MY personal channel for incoming calls
            channel = supabase.channel(`user:${userId}`, {
                config: {
                    broadcast: { self: false },
                    presence: { key: userId }
                }
            });

            console.log(`[CallManager] Initializing channel for user:${userId}`);

            channel
                .on("broadcast", { event: "incoming-call" }, (payload: any) => {
                    console.log("[CallManager] Received incoming-call broadcast:", payload);
                    if (!activeCallRef.current && isMounted) {
                        setIncomingCall(payload.payload);
                    }
                })
                .subscribe((status: string, err: any) => {
                    if (err) console.error("[CallManager] Subscribe error:", err);
                    console.log(`[CallManager] Channel status for user:${userId}:`, status);

                    // If closed unexpectedly, we might want to retry, but Supabase usually handles it
                    if (status === 'CLOSED' && isMounted) {
                        console.warn("[CallManager] Channel closed unexpectedly, cleanup will handle it or Supabase will reconnect.");
                    }
                });

            // Heartbeat to keep mobile socket alive
            heartbeat = setInterval(() => {
                if (channel.state === 'joined') {
                    channel.send({ type: "broadcast", event: "heartbeat", payload: { userId } });
                }
            }, 30000);
        };

        setupChannel();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log(`[CallManager] App became visible. User ID: ${userId}, Channel State: ${channel?.state}`);
                // Supabase Realtime usually reconnects automatically, but we can nudge it if it's stuck
                if (channel && channel.state === 'closed') {
                    console.log("[CallManager] Channel is closed, re-subscribing...");
                    if (heartbeat) clearInterval(heartbeat);
                    setupChannel();
                }
            }
        };

        window.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            isMounted = false;
            window.removeEventListener("visibilitychange", handleVisibilityChange);
            if (heartbeat) clearInterval(heartbeat);
            if (channel) {
                console.log(`[CallManager] Cleaning up channel for user:${userId}`);
                supabase.removeChannel(channel);
            }
        };
    }, [userId]);

    // Listen for Outgoing Calls triggered from ChatView
    useEffect(() => {
        const handleOutgoingCall = (e: any) => {
            if (!activeCall && !incomingCall) {
                setActiveCall({
                    roomId: e.detail.roomId,
                    remoteUserId: e.detail.remoteUserId, // Can be null for groups
                    isCaller: true,
                    callType: e.detail.callType,
                    isGroup: e.detail.isGroup
                });
            }
        };

        window.addEventListener('start-outgoing-call', handleOutgoingCall);
        return () => window.removeEventListener('start-outgoing-call', handleOutgoingCall);
    }, [activeCall, incomingCall]);

    const handleAcceptCall = () => {
        if (!incomingCall) return;

        setActiveCall({
            roomId: incomingCall.roomId,
            remoteUserId: incomingCall.callerId,
            isCaller: false,
            callType: incomingCall.callType,
            isGroup: incomingCall.isGroup
        });
        setIncomingCall(null);
    };

    const handleRejectCall = () => {
        setIncomingCall(null);
        // Optional: Send reject event back
    };

    const handleEndCall = async (duration: number) => {
        if (activeCallRef.current && activeCallRef.current.isCaller && activeCallRef.current.roomId) {
            // Save call log message
            await supabase.from("messages").insert({
                conversation_id: activeCallRef.current.roomId,
                sender_id: userId,
                content: `[CALL_LOG]:${activeCallRef.current.callType}:${duration}`
            });
        }
        setActiveCall(null);
    };

    return (
        <>
            {/* Floating Incoming Call Notification - Instagram/WhatsApp Dual Vibes */}
            {incomingCall && (
                <div className="fixed left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-md animate-in slide-in-from-top-8 fade-in duration-500 ease-out" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
                    <div className="bg-[#1c272e]/98 backdrop-blur-3xl border border-white/10 p-4 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] ring-1 ring-[#00a884]/30 flex items-center justify-between gap-4 transform-gpu">
                        <div className="flex items-center gap-3 overflow-hidden ml-1">
                            {/* Inner Ring Glow */}
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#00a884] rounded-full blur-md opacity-30 animate-pulse" />
                                <Avatar className="w-14 h-14 border-2 border-[#1c272e] ring-2 ring-[#00a884]/60 shrink-0 relative z-10 bg-[#111b21]">
                                    {incomingCall.isGroup ? (
                                        <Users className="w-6 h-6 m-auto text-white/80 mt-3" />
                                    ) : (
                                        <AvatarImage src={incomingCall.callerAvatar} />
                                    )}
                                    <AvatarFallback className="bg-[#0b141a] text-white font-medium text-lg">{incomingCall.callerName?.[0]}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex flex-col min-w-0 py-1">
                                <span className="font-semibold text-white/95 text-[17px] tracking-tight truncate leading-tight">
                                    {incomingCall.isGroup ? `${incomingCall.callerName} (Group)` : incomingCall.callerName}
                                </span>
                                <span className="text-[13px] text-[#00a884] font-medium truncate flex items-center gap-1.5 mt-0.5">
                                    {incomingCall.callType === 'audio' ? <Phone className="w-3.5 h-3.5 animate-pulse" /> : <Video className="w-3.5 h-3.5 animate-pulse" />}
                                    {incomingCall.callType === 'audio' ? 'Voice call...' : 'Video call...'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 mr-1">
                            <button
                                onClick={handleRejectCall}
                                className="w-11 h-11 rounded-full bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444] hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            >
                                <PhoneOff className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleAcceptCall}
                                className="w-11 h-11 rounded-full bg-[#00a884] flex items-center justify-center text-[#111b21] hover:bg-[#00cfa3] transition-all shadow-[0_0_15px_rgba(0,168,132,0.4)] animate-bounce active:scale-90"
                            >
                                {incomingCall.callType === 'audio' ? <Phone className="w-5 h-5 fill-current" /> : <Video className="w-5 h-5 fill-current" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeCall && !activeCall.isGroup && (
                <VideoCallWindow
                    roomId={activeCall.roomId}
                    remoteUserId={activeCall.remoteUserId}
                    isCaller={activeCall.isCaller}
                    callType={activeCall.callType}
                    onEndCall={handleEndCall}
                    initialMinimized={!activeCall.isCaller}
                />
            )}

            {activeCall && activeCall.isGroup && userId && (
                <GroupCallWindow
                    roomId={activeCall.roomId}
                    currentUserId={userId}
                    callType={activeCall.callType}
                    onEndCall={handleEndCall}
                    initialMinimized={!activeCall.isCaller}
                />
            )}
        </>
    );
}
