"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Check, Music2, Scissors, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; 
    onTrimChange: (start: number, end: number) => void;
    onConfirm?: () => void;
}

/**
 * ─── ConnectSphere-Premium (v15 - PIXEL PERFECT CLONE) ─────────────────
 * DESIGN: Orange/Black 'Premium Flexible Trimmer'
 * VISUALS: Bottom-Aligned Single-Sided Waves + Precision Floating Tooltips
 * INTERACTION: Responsive Centered Scroll + Dual Handle Resize
 * PERF: Optimized Data Streaming
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration = 30, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [trimDuration, setTrimDuration] = useState(Math.min(15, duration));
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isDecoding, setIsDecoding] = useState(true);
    const [activeHandle, setActiveHandle] = useState<"start" | "end" | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const startRef = useRef(0);
    const trimRef = useRef(15);
    const raftRef = useRef<number | null>(null);
    const isInteractingRef = useRef(false);

    const PX_PER_SEC = 55; 
    const totalWaveformWidth = duration * PX_PER_SEC;

    useEffect(() => {
        startRef.current = start;
        trimRef.current = trimDuration;
    }, [start, trimDuration]);

    // ─── Phase 1: Premium Peak Engine ────────────────────────────────
    useEffect(() => {
        const seed = Array.from({ length: 200 }).map((_, i) => 
            0.1 + (Math.sin(i * 0.15) * 0.2) + (Math.random() * 0.3)
        );
        setPeaks(seed);
        
        let active = true;
        const decode = async () => {
            if (!audioUrl) return;
            try {
                const res = await fetch(audioUrl, { headers: { 'Range': 'bytes=0-8000000' } }).catch(() => fetch(audioUrl));
                const blob = await res.arrayBuffer();
                const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
                const buffer = await offline.decodeAudioData(blob);
                
                if (active) {
                    const data = buffer.getChannelData(0);
                    const bars = Math.floor(duration * 6); 
                    const step = Math.floor(data.length / bars);
                    const p: number[] = [];
                    for (let i = 0; i < bars; i++) {
                        let m = 0;
                        for (let j = 0; j < step; j += 40) {
                            const v = Math.abs(data[i * step + j] || 0);
                            if (v > m) m = v;
                        }
                        p.push(Math.pow(m * 2, 0.7));
                    }
                    setPeaks(p);
                }
            } catch (e) {
                console.warn("Visuals using pulse-seed fallback.");
            } finally {
                if (active) setIsDecoding(false);
            }
        };
        decode();
        return () => { active = false; };
    }, [audioUrl, duration]);

    // ─── Phase 2: Playback Logic ─────────────────────────────────────
    const stopPlayback = useCallback(() => {
        if (audioRef.current) audioRef.current.pause();
        if (raftRef.current) cancelAnimationFrame(raftRef.current);
        setIsPlaying(false);
    }, []);

    const startPlayback = useCallback(() => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        const sTime = startRef.current;
        const eTime = sTime + trimRef.current;

        audio.currentTime = sTime;
        audio.play().catch(() => {});
        setIsPlaying(true);
        
        const syncLoop = () => {
            if (isInteractingRef.current) return;
            setCurrentTime(audio.currentTime);
            if (audio.currentTime >= eTime || audio.currentTime < sTime - 0.2) {
                audio.currentTime = sTime;
            }
            raftRef.current = requestAnimationFrame(syncLoop);
        };
        raftRef.current = requestAnimationFrame(syncLoop);
    }, []);

    // ─── Phase 2: Micro-Seek Interaction Engine (Zero Latency) ───────
    const handleDrag = (type: "scroll" | "start" | "end" | "playhead", e: React.PointerEvent) => {
        e.preventDefault();
        isInteractingRef.current = true;
        stopPlayback();
        if (type !== "playhead" && type !== "scroll") setActiveHandle(type);
        
        const initialX = e.clientX;
        const initialS = startRef.current;
        const initialT = trimRef.current;
        const initialC = audioRef.current?.currentTime || initialS;

        const dragState = { ns: initialS, nt: initialT, nc: initialC };

        const updateAudio = () => {
            if (!isInteractingRef.current || !audioRef.current) return;
            // Native direct-to-pointer seek
            audioRef.current.currentTime = dragState.nc;
            raftRef.current = requestAnimationFrame(updateAudio);
        };

        const onMove = (mv: PointerEvent) => {
            const dx = mv.clientX - initialX;
            const dt = dx / PX_PER_SEC;

            if (type === "scroll") {
                dragState.ns = Math.max(0, Math.min(initialS - dt, duration - initialT));
                dragState.nc = dragState.ns;
                setStart(dragState.ns);
                setCurrentTime(dragState.ns);
                startRef.current = dragState.ns;
            } else if (type === "start") {
                dragState.ns = Math.max(0, Math.min(initialS + dt, initialS + initialT - 0.5));
                dragState.nt = initialT - (dragState.ns - initialS);
                dragState.nc = dragState.ns;
                setStart(dragState.ns);
                setTrimDuration(dragState.nt);
                setCurrentTime(dragState.ns);
                startRef.current = dragState.ns;
                trimRef.current = dragState.nt;
            } else if (type === "end") {
                dragState.nt = Math.max(0.5, Math.min(initialT + dt, duration - initialS));
                dragState.nc = initialS + dragState.nt;
                setTrimDuration(dragState.nt);
                setCurrentTime(dragState.nc);
                trimRef.current = dragState.nt;
            } else if (type === "playhead") {
                // Seek within the current trim window
                const percent = Math.max(0, Math.min(1, (mv.clientX - (window.innerWidth / 2 - (initialT * PX_PER_SEC) / 2)) / (initialT * PX_PER_SEC)));
                dragState.nc = initialS + (percent * initialT);
                setCurrentTime(dragState.nc);
            }
        };

        const onUp = () => {
            isInteractingRef.current = false;
            if (raftRef.current) cancelAnimationFrame(raftRef.current);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            onTrimChange(startRef.current, startRef.current + trimRef.current);
            startPlayback();
            setActiveHandle(null);
        };

        raftRef.current = requestAnimationFrame(updateAudio);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sc = Math.floor(s % 60);
        return `${m}:${sc.toString().padStart(2, "0")}`;
    };

    return (
        <div className="bg-[#0e0e10] border border-white/5 rounded-[2rem] p-8 space-y-10 shadow-2xl relative overflow-hidden select-none group max-w-2xl mx-auto">
            <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" preload="metadata" className="hidden" />

            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Scissors className="w-6 h-6 text-[#FF7E5F]" />
                    <h2 className="text-[#FF7E5F] font-black text-sm tracking-[0.2em] uppercase italic">
                        Premium Flexible Trimmer
                    </h2>
                </div>
                <div className="bg-[#1a1a1c] border border-white/5 px-6 py-2.5 rounded-full flex items-center gap-2">
                    <span className="text-[#FF7E5F] font-mono font-black text-xs">
                        {formatTime(start)} — {formatTime(start + trimDuration)}
                    </span>
                    <span className="text-zinc-600 font-mono text-[10px] font-bold">
                        ({trimDuration.toFixed(1)}s)
                    </span>
                </div>
            </div>

            {/* Viewport Area */}
            <div className="relative h-48 bg-[#121214] rounded-[1.5rem] overflow-hidden border border-white/5 flex items-end shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]">
                
                {/* Sampling Indicator */}
                {isDecoding && (
                    <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                        <Loader2 className="w-3 h-3 text-[#FF7E5F] animate-spin" />
                        <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Sampling...</span>
                    </div>
                )}

                {/* Scrollable Waveform (Bottom Aligned) */}
                <div 
                    className="flex items-end h-full will-change-transform z-10 cursor-grab active:cursor-grabbing px-[50%]"
                    style={{ 
                        width: `${totalWaveformWidth}px`,
                        transform: `translateX(calc(-${(trimDuration * PX_PER_SEC) / 2}px - ${start * PX_PER_SEC}px))`
                    }}
                    onPointerDown={(e) => handleDrag("scroll", e)}
                >
                    <div className="flex items-end gap-[1.5px] h-[75%] pb-4">
                        {peaks.map((h, i) => {
                            const time = (i / peaks.length) * duration;
                            const isActive = time >= start && time <= start + trimDuration;
                            return (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "w-[3px] rounded-t-full transition-all duration-300",
                                        isActive ? "bg-[#FF7E5F] shadow-[0_0_8px_rgba(255,126,95,0.4)]" : "bg-white/10"
                                    )} 
                                    style={{ height: `${10 + h * 90}%` }} 
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Fixed Selection Window (Centered) */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-30">
                    <div 
                        className="h-full border-t border-b border-[#FF7E5F]/30 bg-[#FF7E5F]/[0.02] relative pointer-events-auto"
                        style={{ width: `${trimDuration * PX_PER_SEC}px` }}
                        onPointerDown={(e) => handleDrag("scroll", e)}
                    >
                        {/* LEFT HANDLE */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("start", e); }} 
                            className="absolute inset-y-0 -left-1.5 w-3 cursor-ew-resize z-40 flex items-center justify-center group/h" 
                        >
                            <div className="w-[4px] h-[95%] bg-white rounded-full shadow-[0_0_15px_white] group-hover/h:scale-x-125 transition-transform" />
                            {activeHandle === "start" && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-md border border-white/10 whitespace-nowrap shadow-xl">
                                    {formatTime(start)}
                                </div>
                            )}
                        </div>

                        {/* RIGHT HANDLE */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("end", e); }} 
                            className="absolute inset-y-0 -right-1.5 w-3 cursor-ew-resize z-40 flex items-center justify-center group/h" 
                        >
                            <div className="w-[4px] h-[95%] bg-white rounded-full shadow-[0_0_15px_white] group-hover/h:scale-x-125 transition-transform" />
                            {activeHandle === "end" && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-md border border-white/10 whitespace-nowrap shadow-xl">
                                    {formatTime(start + trimDuration)}
                                </div>
                            )}
                        </div>

                        {/* Playhead (Vertical Line - DRAGGABLE) */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("playhead", e); }}
                            className="absolute inset-y-0 w-1.5 bg-white z-50 shadow-[0_0_20px_white] cursor-ew-resize group/p transition-transform" 
                            style={{ left: `${((currentTime - start) / trimDuration) * 100}%` }} 
                        >
                            {/* Hit area expansion for easier dragging */}
                            <div className="absolute inset-y-0 -left-2 -right-2 bg-transparent" />
                            <div className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_15px_white] scale-0 group-hover/p:scale-100 transition-transform" />
                            <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_15px_white] scale-0 group-hover/p:scale-100 transition-transform" />
                        </div>
                    </div>
                </div>

                {/* Blocker Overlays */}
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#121214] to-transparent z-40 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#121214] to-transparent z-40 pointer-events-none" />
            </div>


            {/* Controls Area */}
            <div className="flex flex-col gap-10">
                <div className="flex justify-center items-center gap-16">
                    <button
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        className="w-20 h-20 bg-[#1a1a1c] border border-white/5 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl group"
                    >
                        {isPlaying ? <Pause className="w-10 h-10 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white ml-1.5" />}
                    </button>

                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="w-20 h-20 bg-gradient-to-br from-[#FF7E5F] to-[#FF512F] rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-[0_15px_35px_rgba(255,126,95,0.3)] ring-1 ring-white/20"
                        >
                            <Check className="w-10 h-10 text-white stroke-[4]" />
                        </button>
                    )}
                </div>

                {/* Footer Instructions */}
                <p className="text-center text-zinc-600 text-[10px] font-bold tracking-[0.3em] uppercase opacity-70">
                    Drag to move selection • Grab edges to resize clip
                </p>
            </div>

            {/* Visual Flairs */}
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#FF7E5F]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#FF512F]/5 rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
}

