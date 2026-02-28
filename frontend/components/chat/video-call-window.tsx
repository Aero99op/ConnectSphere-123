"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface VideoCallWindowProps {
    roomId: string; // The chat conversation ID or unique call ID
    remoteUserId: string;
    isCaller: boolean;
    callType: 'audio' | 'video';
    onEndCall: () => void;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
    ],
};

export function VideoCallWindow({ roomId, remoteUserId, isCaller, callType, onEndCall }: VideoCallWindowProps) {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
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
                const stream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });
                localStream.current = stream;
                if (localVideoRef.current && callType === 'video') localVideoRef.current.srcObject = stream;

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
        if (callType === 'audio') {
            toast.info("Yeh voice call hai, video nahi chalu kar sakte.");
            return;
        }

        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    return (
        <div className={cn(
            "fixed transition-all duration-300 z-50 shadow-2xl overflow-hidden bg-black border border-zinc-800",
            isMinimized
                ? "bottom-24 right-4 w-40 h-60 rounded-xl"
                : "inset-0 md:inset-10 md:rounded-2xl"
        )}>
            {/* Remote Video/Audio Context (Main) */}
            <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                {/* Always attach the media stream for audio, but only show video if callType is video */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={cn("w-full h-full object-cover", callType === 'audio' ? 'opacity-0 absolute' : '')}
                />

                {/* If Audio Call or Connecting, show Avatar UI */}
                {(callType === 'audio' || connectionStatus === 'connecting') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-md z-10 transition-all duration-500">
                        {/* Cool Desi Aesthetic Pulsing Rings */}
                        <div className="relative flex items-center justify-center mb-8">
                            <div className={cn("absolute w-32 h-32 rounded-full border-2 border-orange-500/20", connectionStatus === 'connected' && "animate-[ping_2s_ease-out_infinite]")} />
                            <div className={cn("absolute w-40 h-40 rounded-full border border-orange-500/10", connectionStatus === 'connected' && "animate-[ping_2.5s_ease-out_infinite]")} />

                            <Avatar className={cn(
                                "w-28 h-28 ring-4 shadow-2xl z-20 relative",
                                connectionStatus === 'connecting' ? "ring-cyan-500/50 animate-pulse" : "ring-orange-500 shadow-orange-500/50"
                            )}>
                                <AvatarImage src={remoteUserProfile?.avatar_url} />
                                <AvatarFallback className="text-4xl bg-zinc-800">{remoteUserProfile?.username?.[0]}</AvatarFallback>
                            </Avatar>
                        </div>

                        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                            {remoteUserProfile?.full_name || remoteUserProfile?.username || "Calling..."}
                        </h2>

                        <div className="flex items-center gap-2">
                            {connectionStatus === 'connecting' ? (
                                <>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                                    </div>
                                    <p className="text-cyan-400 font-medium text-sm animate-pulse">Connecting P2P...</p>
                                </>
                            ) : (
                                <>
                                    {callType === 'audio' && (
                                        <div className="flex items-center gap-1.5 text-orange-400">
                                            <Phone className="w-4 h-4 animate-pulse" />
                                            <p className="font-medium text-sm">Active Voice Call</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Local Video (PiP) - Only show if not minimized AND it's a video call */}
            {!isMinimized && callType === 'video' && (
                <div className="absolute top-4 right-4 w-32 h-48 bg-black rounded-xl border border-white/10 overflow-hidden shadow-2xl ring-1 ring-white/5">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn("w-full h-full object-cover mirror", isVideoOff && "opacity-0")}
                    />
                    {isVideoOff && (
                        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500">
                            <VideoOff className="w-8 h-8 mb-2" />
                            <span className="text-xs">Camera Off</span>
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            {!isMinimized && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30">
                    <button onClick={toggleMute} className={cn("p-4 rounded-full transition-all shadow-lg active:scale-95", isMuted ? "bg-white text-black" : "bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-md")}>
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>

                    <button onClick={() => handleEndCall()} className="p-5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95">
                        <PhoneOff className="w-8 h-8" />
                    </button>

                    {callType === 'video' && (
                        <button onClick={toggleVideo} className={cn("p-4 rounded-full transition-all shadow-lg active:scale-95", isVideoOff ? "bg-white text-black" : "bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-md")}>
                            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                        </button>
                    )}
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
