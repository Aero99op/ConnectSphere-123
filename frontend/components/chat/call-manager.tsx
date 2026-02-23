"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { VideoCallWindow } from "./video-call-window";
import { Phone, PhoneOff } from "lucide-react";
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
            {/* Incoming Call Dialog */}
            <Dialog open={!!incomingCall} onOpenChange={(open: boolean) => !open && handleRejectCall()}>
                <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Incoming Video Call</DialogTitle>
                        <DialogDescription>
                            <div className="flex flex-col items-center gap-4 py-4">
                                <Avatar className="w-20 h-20 ring-2 ring-cyan-500 animate-pulse">
                                    <AvatarImage src={incomingCall?.callerAvatar} />
                                    <AvatarFallback>{incomingCall?.callerName?.[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-xl font-bold">{incomingCall?.callerName} is calling...</span>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-center sm:justify-center gap-4">
                        <Button variant="destructive" size="lg" className="rounded-full w-16 h-16 p-0" onClick={handleRejectCall}>
                            <PhoneOff className="w-8 h-8" />
                        </Button>
                        <Button variant="default" size="lg" className="rounded-full w-16 h-16 p-0 bg-green-500 hover:bg-green-600 animate-bounce" onClick={handleAcceptCall}>
                            <Phone className="w-8 h-8" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Active Call Window */}
            {activeCall && (
                <VideoCallWindow
                    roomId={activeCall.roomId}
                    remoteUserId={activeCall.remoteUserId}
                    isCaller={activeCall.isCaller}
                    onEndCall={handleEndCall}
                />
            )}
        </>
    );
}
