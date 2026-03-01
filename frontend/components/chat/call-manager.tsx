"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { VideoCallWindow } from "./video-call-window";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function CallManager() {
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [activeCall, setActiveCall] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);

            // Subscribe to MY personal channel for incoming calls
            const channel = supabase.channel(`user:${user.id}`);

            channel
                .on("broadcast", { event: "incoming-call" }, (payload) => {
                    // Only show if not already in a call
                    if (!activeCall) {
                        setIncomingCall(payload.payload);
                    } else {
                        // Busy logic here (could send 'busy' event back)
                    }
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };
        init();
    }, [activeCall]);

    // Listen for Outgoing Calls triggered from ChatView
    useEffect(() => {
        const handleOutgoingCall = (e: any) => {
            if (!activeCall && !incomingCall) {
                setActiveCall({
                    roomId: e.detail.roomId,
                    remoteUserId: e.detail.remoteUserId,
                    isCaller: true,
                    callType: e.detail.callType
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
            callType: incomingCall.callType
        });
        setIncomingCall(null);
    };

    const handleRejectCall = () => {
        setIncomingCall(null);
        // Optional: Send reject event back
    };

    const handleEndCall = () => {
        setActiveCall(null);
    };

    return (
        <>
            {/* Floating Incoming Call Notification - Instagram/WhatsApp Dual Vibes */}
            {incomingCall && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-md animate-in slide-in-from-top-4 fade-in duration-500 ease-out">
                    <div className="bg-[#1c272e]/95 backdrop-blur-3xl border border-white/5 p-4 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] ring-1 ring-[#00a884]/20 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 overflow-hidden ml-1">
                            {/* Inner Ring Glow */}
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#00a884] rounded-full blur-md opacity-30 animate-pulse" />
                                <Avatar className="w-14 h-14 border-2 border-[#1c272e] ring-2 ring-[#00a884]/60 shrink-0 relative z-10">
                                    <AvatarImage src={incomingCall.callerAvatar} />
                                    <AvatarFallback className="bg-[#0b141a] text-white font-medium text-lg">{incomingCall.callerName?.[0]}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex flex-col min-w-0 py-1">
                                <span className="font-semibold text-white/95 text-[17px] tracking-tight truncate leading-tight">
                                    {incomingCall.callerName}
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

            {/* Active Call Window */}
            {activeCall && (
                <VideoCallWindow
                    roomId={activeCall.roomId}
                    remoteUserId={activeCall.remoteUserId}
                    isCaller={activeCall.isCaller}
                    callType={activeCall.callType}
                    onEndCall={handleEndCall}
                />
            )}
        </>
    );
}
