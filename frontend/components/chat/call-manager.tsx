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

    const handleAcceptCall = () => {
        if (!incomingCall) return;

        setActiveCall({
            roomId: incomingCall.roomId,
            remoteUserId: incomingCall.callerId,
            isCaller: false
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
            {/* Floating Incoming Call Notification */}
            {incomingCall && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-3xl shadow-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Avatar className="w-12 h-12 border border-white/20 shrink-0">
                                <AvatarImage src={incomingCall.callerAvatar} />
                                <AvatarFallback className="bg-zinc-800 text-white">{incomingCall.callerName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-white truncate text-sm">
                                    {incomingCall.callerName}
                                </span>
                                <span className="text-xs text-zinc-400 truncate flex items-center gap-1">
                                    {incomingCall.callType === 'audio' ? <Phone className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                                    Incoming {incomingCall.callType === 'audio' ? 'Voice' : 'Video'} Call...
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pr-1">
                            <button
                                onClick={handleRejectCall}
                                className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                            >
                                <PhoneOff className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleAcceptCall}
                                className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-all animate-bounce"
                            >
                                {incomingCall.callType === 'audio' ? <Phone className="w-5 h-5" /> : <Video className="w-5 h-5" />}
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
