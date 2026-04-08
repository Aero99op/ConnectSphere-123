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
 * ─── ConnectSphere-Insta-Pro (v18 - SURGICAL REPAIR) ─────────────────
 * FIXES:
 * 1. TypeError 'getBoundingClientRect' fixed via pre-capture.
 * 2. Sliders 'Inside' bug fixed by viewport-aware clamping.
 * 3. Infinite Search & Always-Moving Waveform logic synchronized.
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
    const [activeHandle, setActiveHandle] = useState<"start" | "end" | "playhead" | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const startRef = useRef(0);
    const trimRef = useRef(15);
    const raftRef = useRef<number | null>(null);
    const isInteractingRef = useRef(false);

    const PX_PER_SEC = 100; // Even higher precision for surgical feel
    const totalWidth = duration * PX_PER_SEC;

    useEffect(() => {
        startRef.current = start;
        trimRef.current = trimDuration;
    }, [start, trimDuration]);

    // ─── Phase 1: Peak Sampler (Zero RAM) ──────────────────────────
    useEffect(() => {
        const seed = Array.from({ length: 400 }).map((_, i) => 
            0.1 + (Math.sin(i * 0.1) * 0.1) + (Math.random() * 0.25)
        );
        setPeaks(seed);
        
        let active = true;
        const decode = async () => {
            if (!audioUrl) return;
            try {
                const res = await fetch(audioUrl, { headers: { 'Range': 'bytes=0-6000000' } }).catch(() => fetch(audioUrl));
                const blob = await res.arrayBuffer();
                const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
                const buffer = await offline.decodeAudioData(blob);
                
                if (active) {
                    const data = buffer.getChannelData(0);
                    const bars = Math.floor(duration * 4);
                    const step = Math.floor(data.length / bars);
                    const p: number[] = [];
                    for (let i = 0; i < bars; i++) {
                        let m = 0;
                        for (let j = 0; j < step; j += 60) {
                            const v = Math.abs(data[i * step + j] || 0);
                            if (v > m) m = v;
                        }
                        p.push(Math.pow(m * 2.2, 0.7));
                    }
                    setPeaks(p);
                }
            } catch (e) {
                console.warn("Using pulse-seed fallback.");
            } finally {
                if (active) setIsDecoding(false);
            }
        };
        decode();
        return () => { active = false; };
    }, [audioUrl, duration]);

    // ─── Phase 2: Live Logic ─────────────────────────────────────────
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
            const now = audio.currentTime;
            setCurrentTime(now);
            if (now >= eTime || now < sTime - 0.2) {
                audio.currentTime = sTime;
            }
            raftRef.current = requestAnimationFrame(syncLoop);
        };
        raftRef.current = requestAnimationFrame(syncLoop);
    }, []);

    // ─── Phase 3: Surgical Drag Engine ───────────────────────────────
    const handleDrag = (type: "scroll" | "start" | "end" | "playhead", e: React.PointerEvent) => {
        e.preventDefault();
        isInteractingRef.current = true;
        stopPlayback();
        if (type !== "scroll") setActiveHandle(type);
        
        const rect = e.currentTarget.getBoundingClientRect();
        const initialX = e.clientX;
        const initialS = startRef.current;
        const initialT = trimRef.current;
        const initialC = currentTime;

        const dragState = { ns: initialS, nt: initialT, nc: initialC };

        const onMove = (mv: PointerEvent) => {
            const dx = mv.clientX - initialX;
            const dt = dx / PX_PER_SEC;

            if (type === "scroll") {
                dragState.ns = Math.max(0, Math.min(initialS - dt, duration - initialT));
                dragState.nc = dragState.ns + (dragState.nt / 2);
            } else if (type === "start") {
                dragState.ns = Math.max(0, Math.min(initialS + dt, initialS + initialT - 0.5));
                dragState.nt = initialT - (dragState.ns - initialS);
                dragState.nc = dragState.ns;
            } else if (type === "end") {
                dragState.nt = Math.max(0.5, Math.min(initialT + dt, duration - initialS));
                dragState.nc = initialS + dragState.nt;
            } else if (type === "playhead") {
                const percent = Math.max(0, Math.min(1, (mv.clientX - rect.left) / rect.width));
                dragState.nc = dragState.ns + (percent * dragState.nt);
            }

            setStart(dragState.ns);
            setTrimDuration(dragState.nt);
            setCurrentTime(dragState.nc);
            startRef.current = dragState.ns;
            trimRef.current = dragState.nt;

            if (audioRef.current) {
                audioRef.current.currentTime = dragState.nc;
            }
        };

        const onUp = () => {
            isInteractingRef.current = false;
            setActiveHandle(null);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            onTrimChange(startRef.current, startRef.current + trimRef.current);
            startPlayback();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sc = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 10);
        return `${m}:${sc.toString().padStart(2, "0")}.${ms}`;
    };

    return (
        <div className="bg-[#0e0e10] border border-white/5 rounded-[3rem] p-10 space-y-10 shadow-2xl relative overflow-hidden select-none group max-w-2xl mx-auto">
            <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" preload="metadata" className="hidden" />

            {/* Header Area */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-5">
                    <div className="p-3 bg-gradient-to-tr from-[#FF7E5F] to-[#FF512F] rounded-2xl shadow-[0_0_20px_rgba(255,126,95,0.4)]">
                        <Scissors className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-[#FF7E5F] font-black text-xl tracking-[0.1em] uppercase italic">
                        Premium Flexible Trimmer
                    </h2>
                </div>
                <div className="bg-[#1a1a1c] border border-white/5 px-8 py-4 rounded-[1.5rem] flex flex-col items-center">
                    <span className="text-[#FF7E5F] font-mono font-black text-sm">
                        {formatTime(start)} — {formatTime(start + trimDuration)}
                    </span>
                    <span className="text-zinc-500 font-mono text-[10px] tracking-widest mt-1 uppercase font-black opacity-50">
                        Clip: {trimDuration.toFixed(1)}s
                    </span>
                </div>
            </div>

            {/* Viewport - THE SURGICAL ENGINE */}
            <div className="relative h-64 bg-[#121214] rounded-[2.5rem] overflow-hidden border border-white/5 flex items-center shadow-inner">
                
                {/* Rolling Waveform (Infinite Access) */}
                <div 
                    className="flex items-center h-full will-change-transform z-10 cursor-grab active:cursor-grabbing px-[50%]"
                    style={{ 
                        width: `${totalWidth}px`,
                        // Centers the visible window around the current start position
                        transform: `translateX(calc(-${(trimDuration * PX_PER_SEC) / 2}px - ${start * PX_PER_SEC}px))`
                    }}
                    onPointerDown={(e) => handleDrag("scroll", e)}
                >
                    <div className="flex items-center gap-[1.5px] h-[70%]">
                        {peaks.map((h, i) => {
                            const time = (i / peaks.length) * duration;
                            const isActive = time >= start && time <= start + trimDuration;
                            return (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "w-[4px] rounded-full transition-all duration-300",
                                        isActive ? "bg-[#FF7E5F] shadow-[0_0_10px_#FF7E5F]" : "bg-white/5"
                                    )} 
                                    style={{ height: `${5 + h * 95}%` }} 
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Fixed Viewport Selection Overlay */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-30 px-4">
                    <div 
                        className="h-[95%] border-x-[5px] border-[#FF7E5F] bg-[#FF7E5F]/[0.08] relative pointer-events-auto rounded-[1rem] max-w-full"
                        style={{ width: `${Math.min(trimDuration * PX_PER_SEC, 600)}px` }}
                        onPointerDown={(e) => handleDrag("playhead", e)}
                    >
                        {/* Start Handle (Always stuck to left boundary) */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("start", e); }} 
                            className="absolute inset-y-0 -left-1 w-4 cursor-ew-resize flex items-center justify-center z-40" 
                        >
                            <div className="w-[5px] h-3/4 bg-white shadow-[0_0_20px_white] rounded-full transition-transform active:scale-x-150" />
                        </div>

                        {/* End Handle (Always stuck to right boundary) */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("end", e); }} 
                            className="absolute inset-y-0 -right-1 w-4 cursor-ew-resize flex items-center justify-center z-40" 
                        >
                            <div className="w-[5px] h-3/4 bg-white shadow-[0_0_20px_white] rounded-full transition-transform active:scale-x-150" />
                        </div>

                        {/* PLAYHEAD (Fixed precision tool) */}
                        <div 
                            className="absolute inset-y-0 w-2.5 bg-white z-50 shadow-[0_0_50px_white] flex flex-col items-center" 
                            style={{ 
                                left: `${((currentTime - start) / trimDuration) * 100}%`,
                                transform: 'translateX(-50%)'
                            }} 
                        >
                            {/* Live Floating Time Counter */}
                            <div className="absolute -top-14 bg-white text-black text-[13px] font-black px-5 py-2.5 rounded-2xl shadow-2xl border border-white/10 whitespace-nowrap">
                                {formatTime(currentTime)}
                            </div>
                            <div className="w-1.5 h-full bg-white/40" />
                        </div>
                    </div>
                </div>

                {/* Edge Fades */}
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#121214] via-[#121214]/80 to-transparent z-40 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#121214] via-[#121214]/80 to-transparent z-40 pointer-events-none" />
            </div>

            {/* Interaction Footer */}
            <div className="flex flex-col gap-12">
                <div className="flex justify-center items-center gap-24">
                    <button
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        className="w-28 h-28 bg-[#1a1a1c] border-8 border-white/5 rounded-full flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-2xl"
                    >
                        {isPlaying ? <Pause className="w-12 h-12 text-white fill-white" /> : <Play className="w-12 h-12 text-white fill-white ml-2" />}
                    </button>

                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="w-28 h-28 bg-gradient-to-br from-[#FF7E5F] to-[#FF512F] rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-[0_20px_60px_rgba(255,126,95,0.4)] ring-8 ring-white/5"
                        >
                            <Check className="w-14 h-14 text-white stroke-[5]" />
                        </button>
                    )}
                </div>

                <p className="text-center text-zinc-600 text-[11px] font-black tracking-[0.6rem] uppercase opacity-40">
                    Surgical Precision • Zero RAM Ready
                </p>
            </div>
        </div>
    );
}

