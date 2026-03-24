"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Sparkles, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getApinatorClient } from "@/lib/apinator";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useArVideo } from "@/hooks/use-ar-video";
import { ARFilterId } from "@/lib/ar/ar-engine";
import { generateAllFilters, getFilterById } from "@/lib/ar/proc-ar-generator";
import { ARCategory } from "@/lib/ar/filter-types";

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

    // ── AR State ────────────────────────────────────────────────────────────
    const [arEnabled, setArEnabled] = useState(false);
    const [showArPanel, setShowArPanel] = useState(false);
    const [activeCategory, setActiveCategory] = useState<ARCategory | 'all' | 'premium'>('all');
    const [searchTerm, setSearchTerm] = useState("");

    // Memoize 1000+ filters to avoid re-gen on every render
    const allFilters = useRef(generateAllFilters()).current;

    // Built-in Premium filters (Snapchat-style)
    const PREMIUM_FILTERS = [
        { id: 'none', name: 'None', emoji: '❌', category: 'premium' },
        { id: 'beauty', name: 'Beauty', emoji: '✨', category: 'premium' },
        { id: 'blur_bg', name: 'Blur BG', emoji: '🌫️', category: 'premium' },
        { id: 'dog_filter', name: 'Dog', emoji: '🐶', category: 'premium' },
        { id: 'flower_crown', name: 'Flowers', emoji: '🌸', category: 'premium' },
        { id: 'retro_glasses', name: 'Retro', emoji: '😎', category: 'premium' },
    ];

    const filteredList = (activeCategory === 'all'
        ? allFilters
        : allFilters.filter(f => f.category === activeCategory)
    ).filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.emoji.includes(searchTerm));

    const [rawStream, setRawStream] = useState<MediaStream | null>(null);
    const { processedStream, activeFilter, setFilter } = useArVideo({
        rawStream,
        enabled: arEnabled && callType === 'video',
    });
    // Ref so startCall() (inside useEffect) always reads latest processedStream
    const processedStreamRef = useRef<MediaStream | null>(null);
    processedStreamRef.current = processedStream;

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
            const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', recipientId).single();
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
                setRawStream(stream); // Feed to AR engine
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
                    setRawStream(fallbackStream); // Feed to AR engine
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
            const str = typeof data === 'string' ? data : JSON.stringify(data);
            if (str.length < 8000) {
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: channelName, event, data })
                }).catch(console.error);
                return;
            }

            // Bypass Apinator 10KB limit with chunking
            const numChunks = Math.ceil(str.length / 8000);
            const chunkId = Math.random().toString(36).substring(7);
            for (let i = 0; i < numChunks; i++) {
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: channelName,
                        event: `${event}-chunk`,
                        data: {
                            id: chunkId,
                            i,
                            total: numChunks,
                            chunk: str.substring(i * 8000, (i + 1) * 8000)
                        }
                    })
                }).catch(console.error);
            }
        };

        const incomingChunks: Record<string, string[]> = {};
        const processChunk = (payload: any, eventName: string, finalHandler: (data: any) => void) => {
            if (!incomingChunks[payload.id]) incomingChunks[payload.id] = new Array(payload.total);
            incomingChunks[payload.id][payload.i] = payload.chunk;
            if (incomingChunks[payload.id].filter(Boolean).length === payload.total) { // All arrived
                const fullStr = incomingChunks[payload.id].join('');
                delete incomingChunks[payload.id];
                finalHandler(JSON.parse(fullStr));
            }
        };

        const startCall = async () => {
            const stream = await initMedia();
            if (!stream || isCleaningUp) return;

            // SECURITY FIX (HIGH-05): Fetch ICE config from server (supports TURN)
            const iceConfig = await fetchIceServers();
            peerConnection.current = new RTCPeerConnection(iceConfig);

            // Use AR processed stream if available (via ref to avoid stale closure), otherwise raw stream
            const streamToSend = processedStreamRef.current || stream;
            streamToSend.getTracks().forEach((track) => {
                peerConnection.current?.addTrack(track, streamToSend);
            });

            peerConnection.current.ontrack = (event) => {
                const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);

                if (event.track.kind === 'video' && remoteVideoRef.current) {
                    if (remoteVideoRef.current.srcObject !== stream) {
                        remoteVideoRef.current.srcObject = stream;
                    }
                } else if (event.track.kind === 'audio' && remoteAudioRef.current) {
                    if (remoteAudioRef.current.srcObject !== stream) {
                        remoteAudioRef.current.srcObject = stream;
                    }
                }

                // NOTE: We DO NOT set connectionStatus to 'connected' here! 
                // onTrack fires synchronously when SDP is processed, NOT when packets actually flow!
                // Safely trigger playback after state has settled
                setTimeout(() => {
                    if (remoteVideoRef.current && remoteVideoRef.current.paused) {
                        remoteVideoRef.current.play().catch(e => console.warn("[VideoCall] Video play blocked:", e));
                    }
                    if (remoteAudioRef.current && remoteAudioRef.current.paused) {
                        remoteAudioRef.current.play().catch(e => console.warn("[VideoCall] Audio play blocked:", e));
                    }
                }, 500);
            };

            peerConnection.current.oniceconnectionstatechange = () => {
                const state = peerConnection.current?.iceConnectionState;
                console.log("[WebRTC] ICE State:", state);
                if (state === 'connected' || state === 'completed') {
                    setConnectionStatus("connected");
                } else if (state === 'failed') {
                    // CRITICAL FIX: Try ICE restart before giving up
                    console.warn("[WebRTC] ICE failed — attempting restart...");
                    if (peerConnection.current && !isIncoming && peerConnection.current.signalingState !== 'closed') {
                        try {
                            peerConnection.current.restartIce();
                            // Re-create and send offer with iceRestart flag
                            peerConnection.current.createOffer({ iceRestart: true }).then(offer => {
                                return peerConnection.current?.setLocalDescription(offer);
                            }).then(() => {
                                sendSignal('call-offer', { offer: peerConnection.current?.localDescription });
                                console.log("[WebRTC] 🔄 ICE restart offer sent");
                            }).catch(e => {
                                console.error("[WebRTC] ICE restart failed:", e);
                                toast.error("Call failed to connect (Network Firewall/NAT blocked).");
                                setConnectionStatus("disconnected");
                                handleEndCall(false);
                            });
                        } catch (e) {
                            console.error("[WebRTC] ICE restart not supported:", e);
                            toast.error("Call failed to connect (Network Firewall/NAT blocked).");
                            setConnectionStatus("disconnected");
                            handleEndCall(false);
                        }
                    } else {
                        toast.error("Call failed to connect (Network Firewall/NAT blocked).");
                        setConnectionStatus("disconnected");
                        handleEndCall(false);
                    }
                } else if (state === 'disconnected') {
                    console.warn("[WebRTC] Connection temporarily disconnected. Waiting to recover...");
                    // DO NOT terminate here! WebRTC often recovers from 'disconnected'.
                }
            };

            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignal('ice-candidate', { candidate: event.candidate, from: !isIncoming ? 'caller' : 'receiver' });
                }
            };

            // Listen for signaling events from Apinator
            channel.bind('receiver-ready', async () => {
                if (!isIncoming && peerConnection.current) {
                    if (peerConnection.current.signalingState === 'stable' && !hasCreatedOffer) {
                        try {
                            hasCreatedOffer = true;
                            const offer = await peerConnection.current.createOffer();
                            await peerConnection.current.setLocalDescription(offer);
                            sendSignal('call-offer', { offer });
                        } catch (err) {
                            console.error("Error creating offer:", err);
                            hasCreatedOffer = false;
                        }
                    } else if (peerConnection.current.signalingState === 'have-local-offer') {
                        // Resend the offer in case it was lost in apinator abyss
                        sendSignal('call-offer', { offer: peerConnection.current.localDescription });
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

            const handleOffer = async (payload: any) => {
                if (isIncoming && peerConnection.current) {
                    try {
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
            };

            channel.bind('call-offer', async (data: any) => {
                handleOffer(typeof data === 'string' ? JSON.parse(data) : data);
            });
            channel.bind('call-offer-chunk', async (data: any) => {
                processChunk(typeof data === 'string' ? JSON.parse(data) : data, 'call-offer', handleOffer);
            });

            const handleAnswer = async (payload: any) => {
                if (!isIncoming && peerConnection.current && !hasSetAnswer) {
                    try {
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
            };

            channel.bind('call-answer', async (data: any) => {
                handleAnswer(typeof data === 'string' ? JSON.parse(data) : data);
            });
            channel.bind('call-answer-chunk', async (data: any) => {
                processChunk(typeof data === 'string' ? JSON.parse(data) : data, 'call-answer', handleAnswer);
            });

            channel.bind('end-call', () => {
                handleEndCall(false);
            });

            channel.bind('caller-ready', async () => {
                if (isIncoming) {
                    sendSignal('receiver-ready', {});
                    if (peerConnection.current && peerConnection.current.signalingState === 'stable' && isRemoteDescriptionSet) {
                         // Resend the answer in case it was lost
                         sendSignal('call-answer', { answer: peerConnection.current.localDescription });
                    }
                }
            });

            // Signal readiness with RETRY LOOP (fixes race condition!)
            // Both sides keep signaling until connection is established
            let readyAttempts = 0;
            const maxAttempts = 15; // 15 attempts × 2s = 30s window (Better for slow mobile data)

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

            // Start immediately — NO DELAY! The 500ms delay caused a critical race condition
            // where the caller's signal could arrive before the receiver finished binding events.
            signalReady();
            readyInterval = setInterval(signalReady, 2000);
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
                channel.unbind('call-offer-chunk');
                channel.unbind('call-answer');
                channel.unbind('call-answer-chunk');
                channel.unbind('end-call');
                channel.unbind('receiver-ready');
                channel.unbind('caller-ready');
            }
            client.unsubscribe(channelName);
        };
    }, []);

    // Dynamically replace tracks when AR Engine activates/deactivates
    useEffect(() => {
        if (!peerConnection.current || !processedStream) return;
        const senders = peerConnection.current.getSenders();
        processedStream.getTracks().forEach((newTrack) => {
            const sender = senders.find(s => s.track && s.track.kind === newTrack.kind);
            if (sender) sender.replaceTrack(newTrack).catch(console.error);
        });
    }, [processedStream]);

    const handleEndCall = (sendEvent = true) => {
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        if (sendEvent) {
            // Cancel ringing for the recipient if we are the caller
            if (!isIncoming) {
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: `private-call-${recipientId}`,
                        event: 'cancel-call',
                        data: { roomId }
                    })
                }).catch(console.error);
            }

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
                {/* Video Element for Video Calls (ALWAYS MUTED to bypass strict Mobile Safari/Chrome autoPlay constraints) */}
                {callType === 'video' && (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover transition-transform duration-100 ease-out"
                        style={{ transform: `translate3d(${gyro.x * 0.5}px, ${gyro.y * 0.5}px, 0)` }}
                    />
                )}

                {/* Audio Element for both Video and Voice calls */}
                <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

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
                    {/* AR active indicator on PiP */}
                    {arEnabled && activeFilter !== 'none' && (
                        <div className="absolute top-1 left-1 bg-purple-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <span>{(getFilterById(activeFilter) || PREMIUM_FILTERS.find(f => f.id === activeFilter))?.emoji}</span>
                            <span>AR</span>
                        </div>
                    )}
                </div>
            )}

            {/* AR Filter Panel (Snapchat-style mega browser) */}
            {!isMinimized && showArPanel && callType === 'video' && (
                <div className="absolute bottom-32 md:bottom-40 left-0 w-full z-40 px-3 md:px-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="relative bg-[#111b21]/95 backdrop-blur-3xl rounded-[2.5rem] p-4 md:p-5 border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.5)] max-h-[50vh] md:max-h-[60vh] flex flex-col">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                <span className="text-white font-bold text-lg tracking-tight">AR Filters <span className="text-xs font-normal text-white/40 ml-1">Snapchat Mode</span></span>
                            </div>
                            <button
                                onClick={() => setShowArPanel(false)}
                                className="text-white/40 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="mb-4 relative">
                            <input
                                type="text"
                                placeholder="Search filters... (e.g. fire, 💎)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            />
                        </div>

                        {/* Categories Bar */}
                        <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-hide no-scrollbar">
                            {(['all', 'premium', 'headwear', 'eyewear', 'facial', 'environment', 'distort'] as const).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all border",
                                        activeCategory === cat
                                            ? "bg-white text-black border-white shadow-lg"
                                            : "bg-white/5 text-white/60 border-white/5 hover:bg-white/10"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Filter Grid (Scrollable) */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-3 overflow-y-auto pr-1 pb-4 flex-1 scroll-smooth no-scrollbar">
                            {/* Show Premium / Featured first if in 'all' or 'premium' or no search */}
                            {( (activeCategory === 'all' || activeCategory === 'premium') && !searchTerm) && PREMIUM_FILTERS.map((filter) => (
                                <button
                                    key={filter.id}
                                    onClick={() => {
                                        setFilter(filter.id);
                                        if (filter.id !== 'none') setArEnabled(true);
                                    }}
                                    className={cn(
                                        "aspect-square flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-300 border",
                                        activeFilter === filter.id && arEnabled
                                            ? "bg-purple-600 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105"
                                            : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )}
                                >
                                    <span className="text-2xl md:text-3xl">{filter.emoji}</span>
                                    <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{filter.name}</span>
                                </button>
                            ))}

                            {/* Procedural Filters */}
                            {filteredList.map((filter) => (
                                <button
                                    key={filter.id}
                                    onClick={() => {
                                        setFilter(filter.id);
                                        setArEnabled(true);
                                    }}
                                    className={cn(
                                        "aspect-square flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all duration-300 border",
                                        activeFilter === filter.id && arEnabled
                                            ? "bg-purple-600 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105 z-10"
                                            : "bg-white/5 border-white/5 hover:bg-white/10 group"
                                    )}
                                >
                                    <span className="text-2xl group-hover:scale-125 transition-transform duration-300">{filter.emoji}</span>
                                    <span className="text-[8px] font-medium text-white/40 group-hover:text-white/80 transition-colors uppercase tracking-widest overflow-hidden text-ellipsis w-full text-center px-1">
                                        #{filter.id.split('-')[1]}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Footer Controls */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-xs">AR Status</span>
                                <span className="text-[10px] text-white/40">{arEnabled ? 'Core & GPU Active' : 'Physics Suspended'}</span>
                            </div>
                            <button
                                onClick={() => setArEnabled(!arEnabled)}
                                className={cn(
                                    "relative w-12 h-6 rounded-full transition-all duration-500 p-1",
                                    arEnabled ? "bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]" : "bg-white/10"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                                    arEnabled ? "translate-x-6" : "translate-x-0"
                                )} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls Platform */}
            {!isMinimized && (
                <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-black via-black/80 to-transparent flex items-end justify-center pb-10 z-30">
                    <div className="flex items-center gap-4 px-6 py-4 bg-[#202c33]/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/5">
                        {callType === 'video' && (
                            <button onClick={toggleVideo} className={cn("p-4 rounded-full transition-all active:scale-90", isVideoOff ? "bg-white text-black" : "bg-[#38464d] text-white hover:bg-[#4a5a63]")}>
                                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                            </button>
                        )}

                        {/* AR Filter Button - only on video calls */}
                        {callType === 'video' && (
                            <button
                                onClick={() => setShowArPanel(!showArPanel)}
                                className={cn(
                                    "p-4 rounded-full transition-all active:scale-90 relative",
                                    showArPanel || (arEnabled && activeFilter !== 'none')
                                        ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]"
                                        : "bg-[#38464d] text-white hover:bg-[#4a5a63]"
                                )}
                            >
                                <Sparkles className="w-6 h-6" />
                                {arEnabled && activeFilter !== 'none' && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
                                )}
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
