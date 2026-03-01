"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Maximize2, Minimize2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface GroupCallWindowProps {
    roomId: string; // The group conversation ID
    currentUserId: string;
    callType: 'audio' | 'video';
    onEndCall: (duration: number) => void;
    initialMinimized?: boolean;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
    ],
};

export function GroupCallWindow({ roomId, currentUserId, callType, onEndCall, initialMinimized = false }: GroupCallWindowProps) {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [isMinimized, setIsMinimized] = useState(initialMinimized);
    const [duration, setDuration] = useState(0);
    const [participants, setParticipants] = useState<{ id: string, profile: any, stream: MediaStream | null }[]>([]);

    // Using refs for mutable state that doesn't need to trigger re-renders immediately
    const durationRef = useRef(0);
    const localStreamRef = useRef<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const channelRef = useRef<any>(null);

    // Map of userId -> RTCPeerConnection
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    // Map of userId -> HTMLVideoElement
    const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

    // Format Duration MM:SS
    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        let isCleaningUp = false;

        const initCall = async () => {
            try {
                // 1. Get Local Media
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: callType === 'video' ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });

                if (isCleaningUp) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                localStreamRef.current = stream;
                if (localVideoRef.current && callType === 'video') {
                    localVideoRef.current.srcObject = stream;
                }

                // 2. Setup Channel for Signaling (Full Mesh)
                const channel = supabase.channel(`group-call:${roomId}`, {
                    config: {
                        presence: { key: currentUserId },
                        broadcast: { self: false } // We don't need our own echoes
                    }
                });

                channelRef.current = channel;

                // Handle incoming signaling messages
                channel
                    .on("broadcast", { event: "webrtc-signal" }, async (payload: any) => {
                        const { senderId, type, data } = payload.payload;

                        // Ignore signals from ourselves
                        if (senderId === currentUserId) return;

                        let pc = peerConnectionsRef.current.get(senderId);

                        if (type === 'offer') {
                            // Only create connection if we don't have one (e.g. they joined after us)
                            if (!pc) {
                                pc = createPeerConnection(senderId, stream, channel);
                            }
                            await pc.setRemoteDescription(new RTCSessionDescription(data));
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);

                            channel.send({
                                type: "broadcast",
                                event: "webrtc-signal",
                                payload: { senderId: currentUserId, targetId: senderId, type: 'answer', data: answer }
                            });
                        } else if (type === 'answer') {
                            // Only handle answers directed specifically to us
                            if (payload.payload.targetId !== currentUserId) return;
                            if (pc) {
                                await pc.setRemoteDescription(new RTCSessionDescription(data));
                            }
                        } else if (type === 'ice-candidate') {
                            if (pc) {
                                try {
                                    await pc.addIceCandidate(new RTCIceCandidate(data));
                                } catch (e) {
                                    console.error("Error adding ice candidate", e);
                                }
                            }
                        }
                    })
                    .on("presence", { event: "sync" }, () => {
                        const presenceState = channel.presenceState();
                        const activeUserIds = Object.keys(presenceState);

                        // Handle new users joining
                        activeUserIds.forEach(id => {
                            if (id !== currentUserId && !peerConnectionsRef.current.has(id)) {
                                console.log("New user joined group call:", id);

                                // Fetch profile for display
                                supabase.from('profiles').select('*').eq('id', id).single().then(({ data }) => {
                                    if (data) {
                                        setParticipants(prev => {
                                            if (prev.find(p => p.id === id)) return prev;
                                            return [...prev, { id, profile: data, stream: null }];
                                        });
                                    }
                                });

                                // Create connection and send offer (Only the person already in the room sends the offer to avoid glare)
                                // We use string comparison to deterministically decide who sends the offer
                                if (currentUserId < id) {
                                    const pc = createPeerConnection(id, stream, channel);
                                    pc.createOffer().then(offer => {
                                        pc.setLocalDescription(offer);
                                        channel.send({
                                            type: "broadcast",
                                            event: "webrtc-signal",
                                            payload: { senderId: currentUserId, targetId: id, type: 'offer', data: offer }
                                        });
                                    });
                                }
                            }
                        });

                        // Handle users leaving
                        setParticipants(prev => prev.filter(p => {
                            const isPresent = activeUserIds.includes(p.id) || p.id === currentUserId;
                            if (!isPresent) {
                                const pc = peerConnectionsRef.current.get(p.id);
                                if (pc) {
                                    pc.close();
                                    peerConnectionsRef.current.delete(p.id);
                                }
                                const videoEl = remoteVideoRefs.current.get(p.id);
                                if (videoEl) {
                                    videoEl.srcObject = null;
                                    remoteVideoRefs.current.delete(p.id);
                                }
                            }
                            return isPresent;
                        }));
                    })
                    .subscribe(async (status) => {
                        if (status === 'SUBSCRIBED') {
                            await channel.track({ joinedAt: Date.now() });

                            // Start timer
                            setInterval(() => {
                                setDuration(prev => {
                                    durationRef.current = prev + 1;
                                    return prev + 1;
                                });
                            }, 1000);
                        }
                    });

            } catch (err: any) {
                console.error("Group call media error:", err);
                toast.error("Camera/Mic access failed.");
                handleEndCall();
            }
        };

        const createPeerConnection = (remoteId: string, localStream: MediaStream, channel: any) => {
            const pc = new RTCPeerConnection(ICE_SERVERS);

            // Add local tracks
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    channel.send({
                        type: "broadcast",
                        event: "webrtc-signal",
                        payload: { senderId: currentUserId, targetId: remoteId, type: 'ice-candidate', data: event.candidate }
                    });
                }
            };

            // Handle incoming tracks
            pc.ontrack = (event) => {
                setParticipants(prev => {
                    const existing = prev.find(p => p.id === remoteId);
                    if (existing) {
                        return prev.map(p => p.id === remoteId ? { ...p, stream: event.streams[0] } : p);
                    }
                    return prev;
                });

                // Attach to video element
                setTimeout(() => {
                    const videoEl = remoteVideoRefs.current.get(remoteId);
                    if (videoEl && !videoEl.srcObject) {
                        videoEl.srcObject = event.streams[0];
                    }
                }, 100);
            };

            peerConnectionsRef.current.set(remoteId, pc);
            return pc;
        };

        initCall();

        return () => {
            isCleaningUp = true;
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
            }
            peerConnectionsRef.current.forEach(pc => pc.close());
            if (channelRef.current) {
                channelRef.current.untrack();
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [roomId, currentUserId, callType]);

    const handleEndCall = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();

        if (channelRef.current) {
            channelRef.current.untrack();
            supabase.removeChannel(channelRef.current);
        }

        onEndCall(durationRef.current);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (callType === 'audio') {
            toast.info("Voice call me video nahi chalta.");
            return;
        }

        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    // Calculate grid layout based on participant count
    const totalVideos = participants.length + (isVideoOff ? 0 : 1);
    let gridCols = "grid-cols-1";
    if (totalVideos === 2) gridCols = "grid-cols-1 md:grid-cols-2";
    else if (totalVideos >= 3 && totalVideos <= 4) gridCols = "grid-cols-2";
    else if (totalVideos >= 5) gridCols = "grid-cols-2 md:grid-cols-3";

    return (
        <div className={cn(
            "fixed transition-all duration-300 z-[9999] overflow-hidden bg-[#0a0a0a] text-white",
            isMinimized
                ? "bottom-24 right-4 w-40 h-52 rounded-2xl shadow-2xl border border-white/10 flex flex-col items-center justify-center bg-[#1a1a1a]"
                : "inset-0 md:inset-4 md:rounded-[2rem] shadow-2xl flex flex-col"
        )}>
            {/* Minimized View */}
            {isMinimized && (
                <>
                    <Users className="w-8 h-8 opacity-70 mb-2 text-[#00a884]" />
                    <span className="text-sm font-semibold text-white/90">Mandli Call</span>
                    <span className="text-[10px] text-zinc-400 mt-1">{formatDuration(duration)}</span>
                    <button onClick={handleEndCall} className="mt-3 p-2 rounded-full bg-red-500 hover:bg-red-600 transition-colors">
                        <PhoneOff className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-white/10"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </>
            )}

            {/* Maxmized View */}
            {!isMinimized && (
                <>
                    {/* Header */}
                    <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="flex flex-col">
                            <span className="text-lg font-semibold flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#00a884]" />
                                Mandli Call
                            </span>
                            <span className="text-sm text-zinc-400 font-medium">
                                {formatDuration(duration)} • {participants.length + 1} Log
                            </span>
                        </div>
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-2.5 rounded-full bg-black/50 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                            <Minimize2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Video Grid */}
                    <div className={cn("flex-1 w-full h-full p-2 pt-20 pb-40 grid gap-2", gridCols)}>
                        {/* Local Video - Only if not audio only and not manually turned off */}
                        {callType === 'video' && !isVideoOff && (
                            <div className="relative rounded-2xl overflow-hidden bg-[#1c1c1e] ring-1 ring-white/10 flex items-center justify-center min-h-[150px]">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover mirror"
                                />
                                <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded-md mb-0 text-xs font-medium backdrop-blur-md">
                                    You {isMuted && <MicOff className="inline w-3 h-3 ml-1 text-red-400" />}
                                </div>
                            </div>
                        )}

                        {/* Remote Participants */}
                        {participants.map((p) => (
                            <div key={p.id} className="relative rounded-2xl overflow-hidden bg-[#1c1c1e] ring-1 ring-white/10 flex items-center justify-center min-h-[150px]">
                                {callType === 'video' ? (
                                    <>
                                        <video
                                            ref={el => { if (el) remoteVideoRefs.current.set(p.id, el); }}
                                            autoPlay
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Fallback if stream hasn't loaded video yet */}
                                        {!p.stream && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c1e]">
                                                <Avatar className="w-20 h-20 animate-pulse">
                                                    <AvatarImage src={p.profile?.avatar_url} />
                                                    <AvatarFallback>{p.profile?.username?.[0]}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-b from-[#1c1c1e] to-black">
                                        <Avatar className={cn("w-24 h-24 ring-4 ring-[#00a884]/30 shadow-2xl mb-4", p.stream ? "animate-pulse" : "")}>
                                            <AvatarImage src={p.profile?.avatar_url} />
                                            <AvatarFallback className="text-2xl">{p.profile?.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        {/* Hidden audio element for voice calls */}
                                        <audio
                                            ref={el => { if (el) { el.srcObject = p.stream; } }}
                                            autoPlay
                                        />
                                    </div>
                                )}
                                <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1.5 rounded-lg mb-0 text-xs font-medium backdrop-blur-md flex items-center gap-2">
                                    {p.profile?.full_name?.split(' ')[0] || p.profile?.username}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Controls Footer */}
                    <div className="absolute bottom-0 left-0 w-full h-36 bg-gradient-to-t from-black via-black/80 to-transparent flex items-end justify-center pb-8 z-30">
                        <div className="flex items-center gap-4 sm:gap-6 px-6 sm:px-8 py-4 bg-[#1c1c1e]/90 backdrop-blur-2xl rounded-full shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10">
                            {callType === 'video' && (
                                <button onClick={toggleVideo} className={cn("p-4 rounded-full transition-all active:scale-90", isVideoOff ? "bg-white text-black" : "bg-[#2c2c2e] text-white hover:bg-[#3ac2c2e]")}>
                                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                </button>
                            )}
                            <button onClick={toggleMute} className={cn("p-4 rounded-full transition-all active:scale-90", isMuted ? "bg-white text-black" : "bg-[#2c2c2e] text-white hover:bg-[#3c3c3e]")}>
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>
                            <button onClick={handleEndCall} className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-90 ml-2">
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
