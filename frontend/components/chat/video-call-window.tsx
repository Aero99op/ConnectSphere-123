"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getApinatorClient } from "@/lib/apinator";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface VideoCallWindowProps {
    roomId: string; // The chat conversation ID or unique call ID
    recipientId: string;
    isIncoming: boolean;
    callType: 'audio' | 'video';
    onEndCall: (duration: number) => void;
    initialMinimized?: boolean;
    currentUserId: string;
}

// SECURITY FIX (HIGH-05): ICE servers fetched from /api/ice-servers (not hardcoded)
// Supports TURN servers for IP privacy when configured server-side
const DEFAULT_ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
    ],
};

async function fetchIceServers(): Promise<RTCConfiguration> {
    try {
        const res = await fetch('/api/ice-servers');
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('[VideoCall] Failed to fetch ICE servers, using fallback', e);
    }
    return DEFAULT_ICE_SERVERS;
}


export function VideoCallWindow({ roomId, recipientId, isIncoming, callType, onEndCall, initialMinimized = false, currentUserId }: VideoCallWindowProps) {
    const { supabase } = useAuth();
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [isMinimized, setIsMinimized] = useState(initialMinimized);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
    const [remoteUserProfile, setRemoteUserProfile] = useState<any>(null);
    const [duration, setDuration] = useState(0);
    const durationRef = useRef(0);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);

    // Gyro Parallax State
    const [gyro, setGyro] = useState({ x: 0, y: 0 });

    // Format Duration MM:SS
    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (connectionStatus === 'connected') {
            timer = setInterval(() => {
                setDuration(prev => {
                    durationRef.current = prev + 1;
                    return prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [connectionStatus]);

    // Device Orientation for Premium Gyro Effect
    useEffect(() => {
        const handleOrientation = (event: DeviceOrientationEvent) => {
            const beta = event.beta || 0;  // X-axis tilt (-180 to 180)
            const gamma = event.gamma || 0; // Y-axis tilt (-90 to 90)

            // Limit the tilt range for subtle effect (e.g., max 15px shift)
            const maxTilt = 15;
            const x = Math.min(Math.max((gamma / 90) * maxTilt, -maxTilt), maxTilt);
            const y = Math.min(Math.max((beta / 90) * maxTilt, -maxTilt), maxTilt);

            setGyro({ x, y });
        };

        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', handleOrientation);
        }

        return () => {
            if (window.DeviceOrientationEvent) {
                window.removeEventListener('deviceorientation', handleOrientation);
            }
        };
    }, []);

    useEffect(() => {
        let isCleaningUp = false;

        // Fetch remote user details for UI
        const fetchUser = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', recipientId).single();
            if (data && !isCleaningUp) setRemoteUserProfile(data);
        };
        fetchUser();

        // 1. Get Local Stream
        const initMedia = async () => {
            try {
                // First attempt: Ideal constraints with noise cancellation
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: callType === 'video' ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });
                if (isCleaningUp) {
                    stream.getTracks().forEach(t => t.stop());
                    return null;
                }
                localStream.current = stream;
                if (localVideoRef.current && callType === 'video') {
                    localVideoRef.current.srcObject = stream;
                }
                return stream;
            } catch (err: any) {
                console.warn("[Media Error - High Constraints]", err.name, err.message);

                // Second attempt: Fallback to basic constraints if advanced ones fail (often happens on Desktop Chrome without a 'user' facing camera)
                try {
                    console.log("Retrying with relaxed constraints...");
                    const fallbackStream = await navigator.mediaDevices.getUserMedia({
                        video: callType === 'video' ? true : false,
                        audio: true
                    });

                    if (isCleaningUp) {
                        fallbackStream.getTracks().forEach(t => t.stop());
                        return null;
                    }
                    localStream.current = fallbackStream;
                    if (localVideoRef.current && callType === 'video') {
                        localVideoRef.current.srcObject = fallbackStream;
                    }
                    return fallbackStream;

                } catch (fallbackErr: any) {
                    console.error("[Media Error - Fallback Failed]", fallbackErr.name, fallbackErr.message);

                    if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
                        toast.error("Camera/Microphone permission denied. Please allow access in browser settings.");
                    } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
                        toast.error("No camera or microphone found.");
                    } else if (fallbackErr.name === 'NotReadableError' || fallbackErr.name === 'TrackStartError') {
                        toast.error("Camera/Microphone is already in use by another application.");
                    } else {
                        // Check for HTTPS mandate in modern browsers
                        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                            toast.error("Browser requires HTTPS for camera access.");
                        } else {
                            toast.error(`Media access failed: ${fallbackErr.message || 'Unknown error'}`);
                        }
                    }

                    handleEndCall(false);
                    return null;
                }
            }
        };

        // Apinator-based WebRTC signaling (UNLIMITED, no Supabase connection)
        const client = getApinatorClient();
        if (!client) return;

        const channelName = `private-webrtc-${roomId}`;
        const channel = client.subscribe(channelName);
        let iceCandidateQueue: RTCIceCandidateInit[] = [];
        let isRemoteDescriptionSet = false;
        let isSubscribed = true; // Apinator connects immediately
        let hasCreatedOffer = false; // Prevent multiple offers
        let hasSetAnswer = false; // Prevent multiple answers
        let readyInterval: NodeJS.Timeout; // For polling readiness

        // Helper to send signaling events via API
        const sendSignal = (event: string, data: any) => {
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: channelName, event, data })
            }).catch(console.error);
        };

        const startCall = async () => {
            const stream = await initMedia();
            if (!stream || isCleaningUp) return;

            // SECURITY FIX (HIGH-05): Fetch ICE config from server (supports TURN)
            const iceConfig = await fetchIceServers();
            peerConnection.current = new RTCPeerConnection(iceConfig);

            stream.getTracks().forEach((track) => {
                peerConnection.current?.addTrack(track, stream);
            });

            peerConnection.current.ontrack = (event) => {
                const stream = event.streams[0] || new MediaStream([event.track]);

                if (callType === 'video' && remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
                    remoteVideoRef.current.srcObject = stream;
                    setConnectionStatus("connected");
                } else if (callType === 'audio' && remoteAudioRef.current && !remoteAudioRef.current.srcObject) {
                    remoteAudioRef.current.srcObject = stream;
                    setConnectionStatus("connected");
                }
            };

            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignal('ice-candidate', { candidate: event.candidate, from: !isIncoming ? 'caller' : 'receiver' });
                }
            };

            // Listen for signaling events from Apinator
            channel.bind('receiver-ready', async () => {
                if (!isIncoming && peerConnection.current && !hasCreatedOffer) {
                    try {
                        hasCreatedOffer = true;
                        const offer = await peerConnection.current.createOffer();
                        await peerConnection.current.setLocalDescription(offer);
                        sendSignal('call-offer', { offer });
                    } catch (err) {
                        console.error("Error creating offer:", err);
                        hasCreatedOffer = false;
                    }
                }
            });

            const processIceQueue = async () => {
                if (!peerConnection.current) return;
                for (const candidate of iceCandidateQueue) {
                    try {
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error("Error adding queued ice candidate", e);
                    }
                }
                iceCandidateQueue = [];
            };

            channel.bind('ice-candidate', async (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                const isFromMe = !isIncoming ? payload.from === 'caller' : payload.from === 'receiver';

                if (peerConnection.current && !isFromMe) {
                    if (!isRemoteDescriptionSet) {
                        iceCandidateQueue.push(payload.candidate);
                    } else {
                        try {
                            await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
                        } catch (err) {
                            console.error("Error adding ice candidate", err);
                        }
                    }
                }
            });

            channel.bind('call-offer', async (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (isIncoming && peerConnection.current) {
                    try {
                        // Crucial fix: ensure we are in a state to accept an offer
                        if (peerConnection.current.signalingState !== 'stable') {
                            console.warn("Got offer but signalingState is", peerConnection.current.signalingState);
                            return;
                        }
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
                        isRemoteDescriptionSet = true;
                        processIceQueue();

                        const answer = await peerConnection.current.createAnswer();
                        await peerConnection.current.setLocalDescription(answer);
                        sendSignal('call-answer', { answer });
                    } catch (err) {
                        console.error("Error handling offer:", err);
                    }
                }
            });

            channel.bind('call-answer', async (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (!isIncoming && peerConnection.current && !hasSetAnswer) {
                    try {
                        // Crucial fix: The core "InvalidStateError" happens when we try to set an answer 
                        // while the signaling state is 'stable' (already connected/answered)
                        if (peerConnection.current.signalingState === 'stable') {
                            console.warn("Got answer but signalingState is already stable. Ignoring.");
                            return;
                        }

                        hasSetAnswer = true;
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
                        isRemoteDescriptionSet = true;
                        processIceQueue();
                    } catch (err) {
                        console.error("Error handling answer:", err);
                        hasSetAnswer = false;
                    }
                }
            });

            channel.bind('end-call', () => {
                handleEndCall(false);
            });

            channel.bind('caller-ready', async () => {
                if (isIncoming) {
                    sendSignal('receiver-ready', {});
                }
            });

            // Signal readiness with RETRY LOOP (fixes race condition!)
            // Both sides keep signaling until connection is established
            let readyAttempts = 0;
            const maxAttempts = 8; // 8 attempts × 2s = 16s window

            const signalReady = () => {
                if (readyAttempts >= maxAttempts || !peerConnection.current ||
                    peerConnection.current.connectionState === 'connected') {
                    clearInterval(readyInterval);
                    return;
                }
                readyAttempts++;
                if (isIncoming) {
                    sendSignal('receiver-ready', {});
                    console.log(`[VideoCall] 📡 Sent receiver-ready (attempt ${readyAttempts})`);
                } else {
                    sendSignal('caller-ready', {});
                    console.log(`[VideoCall] 📡 Sent caller-ready (attempt ${readyAttempts})`);
                }
            };

            // Start immediately, then retry every 2s
            setTimeout(() => {
                signalReady();
                readyInterval = setInterval(signalReady, 2000);
            }, 500);
        };

        startCall();

        const handleBeforeUnload = () => {
            handleEndCall(true);
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            isCleaningUp = true;
            isSubscribed = false;
            clearInterval(readyInterval);
            window.removeEventListener("beforeunload", handleBeforeUnload);

            if (localStream.current) {
                localStream.current.getTracks().forEach(track => track.stop());
            }
            if (peerConnection.current) {
                peerConnection.current.close();
            }

            // CRITICAL FIX: Explicitly unbind all events from this channel before unsubscribing
            // Apinator SDK doesn't support unbind_all(), so we do it manually.
            if (channel) {
                channel.unbind('ice-candidate');
                channel.unbind('call-offer');
                channel.unbind('call-answer');
                channel.unbind('end-call');
                channel.unbind('receiver-ready');
                channel.unbind('caller-ready');
            }
            client.unsubscribe(channelName);
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
            // Send end-call via Apinator
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-webrtc-${roomId}`,
                    event: 'end-call',
                    data: {}
                })
            }).catch(console.error);
        }

        onEndCall(durationRef.current);
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
            "fixed transition-all duration-300 z-[9999] overflow-hidden bg-[#0b141a] text-white", // WA dark mode base color Inspiration
            isMinimized
                ? "bottom-24 right-4 w-40 h-60 rounded-2xl shadow-2xl border border-white/10"
                : "inset-0 md:inset-4 md:rounded-[2rem] shadow-2xl"
        )}>
            {/* Background Texture/Gradient Parallax */}
            <div
                className="absolute inset-[-50px] bg-gradient-to-b from-black/40 via-[#111b21] to-black z-0 pointer-events-none transition-transform duration-100 ease-out"
                style={{ transform: `translate3d(${gyro.x * -1}px, ${gyro.y * -1}px, 0)` }}
            />

            {/* Remote Video/Audio Context (Main) */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden z-10 perspective-1000">
                {/* Audio Element for Voice Calls (Hidden but crucial for playback) */}
                <audio
                    ref={remoteAudioRef}
                    autoPlay
                    playsInline
                    className={cn(callType === 'video' ? 'hidden' : '')}
                />

                {/* Video Element for Video Calls */}
                {callType === 'video' && (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover transition-transform duration-100 ease-out"
                        style={{ transform: `translate3d(${gyro.x * 0.5}px, ${gyro.y * 0.5}px, 0)` }}
                    />
                )}

                {/* If Audio Call or Connecting, show Avatar UI */}
                {(callType === 'audio' || connectionStatus === 'connecting') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111b21]/95 backdrop-blur-xl z-10 transition-all duration-500">
                        {/* Status Header */}
                        <div className="absolute top-12 flex flex-col items-center">
                            <h2 className="text-3xl font-medium tracking-tight mb-2 opacity-90">
                                {remoteUserProfile?.full_name || remoteUserProfile?.username || "Unknown Number"}
                            </h2>
                            <p className="text-[#00a884] font-medium text-sm"> {/* WA Green tracking */}
                                {connectionStatus === 'connected' ? formatDuration(duration) : connectionStatus === 'connecting' ? 'Calling...' : 'Ringing'}
                            </p>
                        </div>

                        {/* Aesthetic Pulsing Rings */}
                        <div className="relative flex items-center justify-center mt-12 mb-8">
                            <div className={cn("absolute w-36 h-36 rounded-full border border-[#00a884]/30", connectionStatus === 'connected' && "animate-[ping_2s_ease-out_infinite]")} />
                            <div className={cn("absolute w-48 h-48 rounded-full border border-[#00a884]/10", connectionStatus === 'connected' && "animate-[ping_2.5s_ease-out_infinite]")} />

                            <Avatar
                                className={cn(
                                    "w-32 h-32 ring-4 shadow-2xl z-20 relative transition-transform duration-100 ease-out",
                                    connectionStatus === 'connecting' ? "ring-[#00a884]/50 animate-pulse" : "ring-[#00a884] shadow-[#00a884]/20"
                                )}
                                style={{ transform: `translate3d(${gyro.x * 1.5}px, ${gyro.y * 1.5}px, 0)` }}
                            >
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
                className={cn("absolute p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm shadow-xl border border-white/10 z-[100]",
                    isMinimized ? "top-2 left-2 p-1.5" : "top-4 left-4"
                )}
            >
                {isMinimized ? <Maximize2 className="w-5 h-5 md:w-4 md:h-4" /> : <Minimize2 className="w-5 h-5" />}
            </button>
        </div>
    );
}
