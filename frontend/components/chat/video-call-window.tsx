"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface VideoCallWindowProps {
    roomId: string; // The chat conversation ID or unique call ID
    remoteUserId: string;
    isCaller: boolean;
    onEndCall: () => void;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
    ],
};

export function VideoCallWindow({ roomId, remoteUserId, isCaller, onEndCall }: VideoCallWindowProps) {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
    const [remoteUserProfile, setRemoteUserProfile] = useState<any>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);

    useEffect(() => {
        // Fetch remote user details for UI
        const fetchUser = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', remoteUserId).single();
            setRemoteUserProfile(data);
        };
        fetchUser();

        // Initialize Call
        const startCall = async () => {
            try {
                // 1. Get Local Stream
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStream.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                // 2. Create Peer Connection
                peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

                // Add Tracks
                stream.getTracks().forEach((track) => {
                    peerConnection.current?.addTrack(track, stream);
                });

                // Handle Remote Stream
                peerConnection.current.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setConnectionStatus("connected");
                    }
                };

                // Handle ICE Candidates
                peerConnection.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        const channel = supabase.channel(`call:${roomId}`);
                        channel.send({
                            type: "broadcast",
                            event: "ice-candidate",
                            payload: { candidate: event.candidate, from: 'me' },
                        });
                    }
                };

                // 3. Signaling Channel
                const channel = supabase.channel(`call:${roomId}`);

                channel
                    .on("broadcast", { event: "ice-candidate" }, async (payload) => {
                        if (peerConnection.current && payload.payload.from !== 'me') {
                            await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
                        }
                    })
                    .on("broadcast", { event: "call-offer" }, async (payload) => {
                        if (!isCaller && peerConnection.current) {
                            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.payload.offer));
                            const answer = await peerConnection.current.createAnswer();
                            await peerConnection.current.setLocalDescription(answer);

                            channel.send({
                                type: "broadcast",
                                event: "call-answer",
                                payload: { answer },
                            });
                        }
                    })
                    .on("broadcast", { event: "call-answer" }, async (payload) => {
                        if (isCaller && peerConnection.current) {
                            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.payload.answer));
                        }
                    })
                    .on("broadcast", { event: "end-call" }, () => {
                        handleEndCall(false); // End without sending event back
                    })
                    .subscribe(async (status) => {
                        if (status === 'SUBSCRIBED') {
                            if (isCaller) {
                                const offer = await peerConnection.current?.createOffer();
                                await peerConnection.current?.setLocalDescription(offer);
                                channel.send({
                                    type: "broadcast",
                                    event: "call-offer",
                                    payload: { offer },
                                });
                            }
                        }
                    });

            } catch (err) {
                console.error("Error starting call:", err);
                toast.error("Could not start camera/microphone");
                onEndCall();
            }
        };

        startCall();

        return () => {
            handleEndCall(true); // Cleanup on unmount
        };
    }, []);

    const handleEndCall = (sendEvent = true) => {
        // Cleanup WebRTC
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        // Notify other peer
        if (sendEvent) {
            const channel = supabase.channel(`call:${roomId}`);
            channel.send({ type: "broadcast", event: "end-call", payload: {} });
        }

        onEndCall();
    };

    const toggleMute = () => {
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    };

    const toggleVideo = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoOff(!videoTrack.enabled);
        }
    };

    return (
        <div className={cn(
            "fixed transition-all duration-300 z-50 shadow-2xl overflow-hidden bg-black border border-zinc-800",
            isMinimized
                ? "bottom-24 right-4 w-40 h-60 rounded-xl"
                : "inset-0 md:inset-10 md:rounded-2xl"
        )}>
            {/* Remote Video (Main) */}
            <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />

                {connectionStatus === 'connecting' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm z-10">
                        <Avatar className="w-24 h-24 mb-4 ring-4 ring-cyan-500/20 animate-pulse">
                            <AvatarImage src={remoteUserProfile?.avatar_url} />
                            <AvatarFallback>{remoteUserProfile?.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-white font-bold animate-pulse">Connecting...</p>
                    </div>
                )}
            </div>

            {/* Local Video (PiP) - Only show if not minimized */}
            {!isMinimized && (
                <div className="absolute top-4 right-4 w-32 h-48 bg-black rounded-lg border border-zinc-700 overflow-hidden shadow-lg">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn("w-full h-full object-cover mirror", isVideoOff && "hidden")}
                    />
                    {isVideoOff && (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500">
                            <VideoOff className="w-8 h-8" />
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            {!isMinimized && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                    <button onClick={toggleMute} className={cn("p-4 rounded-full transition-colors", isMuted ? "bg-white text-black" : "bg-zinc-800/80 text-white hover:bg-zinc-700")}>
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>

                    <button onClick={() => handleEndCall()} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors shadow-lg shadow-red-600/20">
                        <PhoneOff className="w-8 h-8" />
                    </button>

                    <button onClick={toggleVideo} className={cn("p-4 rounded-full transition-colors", isVideoOff ? "bg-white text-black" : "bg-zinc-800/80 text-white hover:bg-zinc-700")}>
                        {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                    </button>
                </div>
            )}

            {/* Minimize/Maximize Toggle */}
            <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="absolute top-4 left-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm"
            >
                {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
            </button>
        </div>
    );
}
