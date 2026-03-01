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
        let isCleaningUp = false;

        // Fetch remote user details for UI
        const fetchUser = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', remoteUserId).single();
            if (data && !isCleaningUp) setRemoteUserProfile(data);
        };
        fetchUser();

        // 1. Get Local Stream
        const initMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });
                if (isCleaningUp) {
                    stream.getTracks().forEach(t => t.stop());
                    return null;
                }
                localStream.current = stream;
                if (localVideoRef.current && callType === 'video') {
                    localVideoRef.current.srcObject = stream;
                }
                return stream;
            } catch (err) {
                console.error("Error getting media:", err);
                toast.error("Could not access camera/microphone");
                handleEndCall(false);
                return null;
            }
        };

        const channel = supabase.channel(`call:${roomId}`);
        let iceCandidateQueue: RTCIceCandidateInit[] = [];
        let isSubscribed = false;

        const startCall = async () => {
            const stream = await initMedia();
            if (!stream || isCleaningUp) return;

            peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

            stream.getTracks().forEach((track) => {
                peerConnection.current?.addTrack(track, stream);
            });

            peerConnection.current.ontrack = (event) => {
                if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
                    remoteVideoRef.current.srcObject = event.streams[0] || new MediaStream([event.track]);
                    setConnectionStatus("connected");
                }
            };

            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    if (isSubscribed) {
                        channel.send({
                            type: "broadcast",
                            event: "ice-candidate",
                            payload: { candidate: event.candidate, from: isCaller ? 'caller' : 'receiver' },
                        });
                    } else {
                        iceCandidateQueue.push(event.candidate);
                    }
                }
            };

            channel
                .on("broadcast", { event: "receiver-ready" }, async () => {
                    if (isCaller && peerConnection.current) {
                        try {
                            const offer = await peerConnection.current.createOffer();
                            await peerConnection.current.setLocalDescription(offer);
                            channel.send({
                                type: "broadcast",
                                event: "call-offer",
                                payload: { offer },
                            });
                        } catch (err) {
                            console.error("Error creating offer:", err);
                        }
                    }
                })
                .on("broadcast", { event: "ice-candidate" }, async (payload) => {
                    const isFromMe = isCaller ? payload.payload.from === 'caller' : payload.payload.from === 'receiver';
                    if (peerConnection.current && !isFromMe) {
                        try {
                            await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
                        } catch (err) {
                            console.error("Error adding ice candidate", err);
                        }
                    }
                })
                .on("broadcast", { event: "call-offer" }, async (payload) => {
                    if (!isCaller && peerConnection.current) {
                        try {
                            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.payload.offer));
                            const answer = await peerConnection.current.createAnswer();
                            await peerConnection.current.setLocalDescription(answer);

                            channel.send({
                                type: "broadcast",
                                event: "call-answer",
                                payload: { answer },
                            });
                        } catch (err) {
                            console.error("Error handling offer:", err);
                        }
                    }
                })
                .on("broadcast", { event: "call-answer" }, async (payload) => {
                    if (isCaller && peerConnection.current) {
                        try {
                            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.payload.answer));
                        } catch (err) {
                            console.error("Error handling answer:", err);
                        }
                    }
                })
                .on("broadcast", { event: "end-call" }, () => {
                    handleEndCall(false);
                })
                .on("broadcast", { event: "caller-ready" }, async () => {
                    if (!isCaller && isSubscribed) {
                        channel.send({
                            type: "broadcast",
                            event: "receiver-ready",
                            payload: {}
                        });
                    }
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        isSubscribed = true;
                        // Send queued ICE candidates
                        while (iceCandidateQueue.length > 0) {
                            const candidate = iceCandidateQueue.shift();
                            await channel.send({
                                type: "broadcast",
                                event: "ice-candidate",
                                payload: { candidate, from: isCaller ? 'caller' : 'receiver' },
                            });
                        }

                        if (!isCaller) {
                            setTimeout(() => {
                                // Tell the caller we are ready to receive the offer!
                                channel.send({
                                    type: "broadcast",
                                    event: "receiver-ready",
                                    payload: {}
                                });
                            }, 800); // 800ms buffer for Supabase sockets to stabilize
                        } else {
                            channel.send({
                                type: "broadcast",
                                event: "caller-ready",
                                payload: {}
                            });
                        }
                    }
                });
        };

        startCall();

        const handleBeforeUnload = () => {
            handleEndCall(true);
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            isCleaningUp = true;
            window.removeEventListener("beforeunload", handleBeforeUnload);
            // Don't call handleEndCall(true) here to prevent React Strict mode from ending the call instantly
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => track.stop());
            }
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            supabase.removeChannel(channel);
        };
    }, []);

    const handleEndCall = (sendEvent = true) => {
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        if (sendEvent) {
            const sendEnd = async () => {
                const sendChannel = supabase.channel(`call:${roomId}`);
                await sendChannel.send({ type: "broadcast", event: "end-call", payload: {} });
            };
            sendEnd();
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
            "fixed transition-all duration-300 z-50 overflow-hidden bg-[#0b141a] text-white", // WA dark mode base color Inspiration
            isMinimized
                ? "bottom-24 right-4 w-40 h-60 rounded-2xl shadow-2xl border border-white/10"
                : "inset-0 md:inset-4 md:rounded-[2rem] shadow-2xl"
        )}>
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 z-0 pointer-events-none" />

            {/* Remote Video/Audio Context (Main) */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden z-10">
                {/* Always attach the media stream for audio, but only show video if callType is video */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={cn("w-full h-full object-cover", callType === 'audio' ? 'opacity-0 absolute' : '')}
                />

                {/* If Audio Call or Connecting, show Avatar UI */}
                {(callType === 'audio' || connectionStatus === 'connecting') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111b21]/95 backdrop-blur-xl z-10 transition-all duration-500">
                        {/* Status Header */}
                        <div className="absolute top-12 flex flex-col items-center">
                            <h2 className="text-3xl font-medium tracking-tight mb-2 opacity-90">
                                {remoteUserProfile?.full_name || remoteUserProfile?.username || "Unknown Number"}
                            </h2>
                            <p className="text-[#00a884] font-medium text-sm"> {/* WA Green tracking */}
                                {connectionStatus === 'connecting' ? 'Calling...' : 'Ringing'}
                            </p>
                        </div>

                        {/* Aesthetic Pulsing Rings */}
                        <div className="relative flex items-center justify-center mt-12 mb-8">
                            <div className={cn("absolute w-36 h-36 rounded-full border border-[#00a884]/30", connectionStatus === 'connected' && "animate-[ping_2s_ease-out_infinite]")} />
                            <div className={cn("absolute w-48 h-48 rounded-full border border-[#00a884]/10", connectionStatus === 'connected' && "animate-[ping_2.5s_ease-out_infinite]")} />

                            <Avatar className={cn(
                                "w-32 h-32 ring-4 shadow-2xl z-20 relative",
                                connectionStatus === 'connecting' ? "ring-[#00a884]/50 animate-pulse" : "ring-[#00a884] shadow-[#00a884]/20"
                            )}>
                                <AvatarImage src={remoteUserProfile?.avatar_url} />
                                <AvatarFallback className="text-5xl bg-[#202c33] text-white/70">{remoteUserProfile?.username?.[0]}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                )}
            </div>

            {/* Local Video (PiP) - Only show if not minimized AND it's a video call */}
            {!isMinimized && callType === 'video' && (
                <div className="absolute top-16 right-4 w-28 h-40 bg-[#202c33] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 z-20 transition-all hover:scale-105 cursor-move">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn("w-full h-full object-cover mirror", isVideoOff && "opacity-0")}
                    />
                    {isVideoOff && (
                        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#202c33] text-white/50 backdrop-blur-md">
                            <VideoOff className="w-6 h-6 mb-1" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Paused</span>
                        </div>
                    )}
                </div>
            )}

            {/* Controls Platform */}
            {!isMinimized && (
                <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-black via-black/80 to-transparent flex items-end justify-center pb-10 z-30">
                    <div className="flex items-center gap-6 px-8 py-4 bg-[#202c33]/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/5">
                        {callType === 'video' && (
                            <button onClick={toggleVideo} className={cn("p-4 rounded-full transition-all active:scale-90", isVideoOff ? "bg-white text-black" : "bg-[#38464d] text-white hover:bg-[#4a5a63]")}>
                                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                            </button>
                        )}

                        <button onClick={toggleMute} className={cn("p-4 rounded-full transition-all active:scale-90", isMuted ? "bg-white text-black" : "bg-[#38464d] text-white hover:bg-[#4a5a63]")}>
                            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>

                        <button onClick={() => handleEndCall()} className="p-5 rounded-full bg-[#ef4444] hover:bg-[#dc2626] text-white transition-all shadow-[0_4px_20px_rgba(239,68,68,0.5)] active:scale-90 ml-2 border-4 border-[#0b141a]">
                            <PhoneOff className="w-7 h-7" />
                        </button>
                    </div>
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
