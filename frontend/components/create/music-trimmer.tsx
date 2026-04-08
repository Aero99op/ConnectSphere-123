"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Play, Pause, Check, Loader2, Music2, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; 
    onTrimChange: (start: number, end: number) => void;
    onConfirm?: () => void;
}

/**
 * ─── ConnectSphere-Pro Trimmer (v12) ───────────────────────────────────
 * DESIGN: Mirrored Pulse Frequencies (Guaranteed Visuals)
 * LOGIC: High-Precision Flexible Trimming + Micro-Seek Engine
 * PERF: RAM-Safe Streaming with Zero Latency Seek
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration = 30, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    // ─── State ────────────────────────────────────────────────────────
    const [start, setStart] = useState(0);
    const [trimDuration, setTrimDuration] = useState(Math.min(30, duration));
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isDecoding, setIsDecoding] = useState(true);

    // ─── Refs for Performance ────────────────────────────────────────
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const startRef = useRef(0);
    const trimRef = useRef(30);
    const raftRef = useRef<number | null>(null);
    const isInteractingRef = useRef(false);

    const PX_PER_SEC = 60;
    const totalWidth = duration * PX_PER_SEC;

    // Sync state to refs for use in loops
    useEffect(() => {
        startRef.current = start;
        trimRef.current = trimDuration;
    }, [start, trimDuration]);

    // ─── Phase 1: Frequency Pulse Generation (Visuals) ───────────────
    useEffect(() => {
        // Guaranteed Fallback Peaks (Never show black box)
        const fallback = Array.from({ length: Math.floor(duration * 3) }).map((_, i) => 
            0.15 + (Math.sin(i * 0.4) * 0.1) + (Math.random() * 0.25)
        );
        setPeaks(fallback);
        
        let active = true;
        const decode = async () => {
            if (!audioUrl) return;
            try {
                // Low RAM Scan (First 10MB)
                const res = await fetch(audioUrl, { headers: { 'Range': 'bytes=0-10000000' } })
                    .catch(() => fetch(audioUrl));
                const blob = await res.arrayBuffer();
                const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
                const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
                const buffer = await offline.decodeAudioData(blob);
                
                if (active) {
                    const data = buffer.getChannelData(0);
                    const bars = Math.floor(duration * 4);
                    const step = Math.floor(data.length / bars);
                    const p: number[] = [];
                    for (let i = 0; i < bars; i++) {
                        let m = 0;
                        for (let j = 0; j < step; j += 50) {
                            const v = Math.abs(data[i * step + j] || 0);
                            if (v > m) m = v;
                        }
                        p.push(Math.pow(m * 1.6, 0.8));
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

    // ─── Phase 2: Snap-Fast Playback Engine ──────────────────────────
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

            // Loop within selection only
            if (now >= eTime || now < sTime - 0.2) {
                audio.currentTime = sTime;
            }
            raftRef.current = requestAnimationFrame(syncLoop);
        };
        raftRef.current = requestAnimationFrame(syncLoop);
    }, []);

    // ─── Phase 3: Hybrid Drag Engine (Start/End Handles) ─────────────
    const handleDrag = (type: "scroll" | "start" | "end", e: React.PointerEvent) => {
        e.preventDefault();
        isInteractingRef.current = true;
        stopPlayback();
        
        const initialX = e.clientX;
        const initialS = startRef.current;
        const initialT = trimRef.current;

        const onMove = (mv: PointerEvent) => {
            const dx = mv.clientX - initialX;
            const dt = dx / PX_PER_SEC;

            let news = initialS;
            let newt = initialT;

            if (type === "scroll") {
                news = Math.max(0, Math.min(initialS - dt, duration - initialT));
            } else if (type === "start") {
                news = Math.max(0, Math.min(initialS + dt, initialS + initialT - 0.5));
                newt = initialT - (news - initialS);
            } else if (type === "end") {
                newt = Math.max(0.5, Math.min(initialT + dt, duration - initialS));
            }

            setStart(news);
            setTrimDuration(newt);
            setCurrentTime(news);
            startRef.current = news;
            trimRef.current = newt;

            // Micro-seek during scrub
            if (audioRef.current) audioRef.current.currentTime = news;
        };

        const onUp = () => {
            isInteractingRef.current = false;
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
        return `${m}:${sc.toString().padStart(2, "0")}`;
    };

    return (
        <div className="bg-[#050505] border border-white/10 rounded-[2.5rem] p-6 space-y-8 shadow-2xl relative overflow-hidden group select-none">
            <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" preload="metadata" className="hidden" />

            {/* Header */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-tr from-[#FF512F] to-[#DD2476] rounded-3xl shadow-lg ring-1 ring-white/20">
                        <Music2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-white/90 tracking-tight">Music Trimmer</h3>
                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em]">{isDecoding ? "Scanning..." : "Frequency Active"}</p>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
                    <span className="text-xs font-mono font-bold text-[#FF512F]">{formatTime(start)}</span>
                    <span className="mx-2 text-zinc-700">/</span>
                    <span className="text-[10px] font-mono text-zinc-400">{trimDuration.toFixed(1)}s</span>
                </div>
            </div>

            {/* Viewport */}
            <div className="relative h-48 bg-[#0a0a0a] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-inner">
                {/* Waveform Mirrored Pulses */}
                <div 
                    className="absolute inset-y-0 flex items-center will-change-transform z-10 cursor-grab active:cursor-grabbing"
                    style={{ 
                        width: `${totalWidth}px`,
                        transform: `translateX(calc(50% - ${(trimDuration * PX_PER_SEC) / 2}px - ${start * PX_PER_SEC}px))`
                    }}
                    onPointerDown={(e) => handleDrag("scroll", e)}
                >
                    <div className="flex items-center gap-[2.5px] px-4 h-full">
                        {peaks.map((h, i) => {
                            const time = (i / peaks.length) * duration;
                            const active = time >= start && time <= start + trimDuration;
                            return (
                                <div key={i} className="flex flex-col items-center gap-[2px] h-32 w-[3px]">
                                    <div className={cn("w-full rounded-t-full transition-all duration-300", active ? "bg-gradient-to-t from-[#FF512F] to-[#DD2476] shadow-[0_0_10px_#FF512F]" : "bg-white/10")} style={{ height: `${10 + h * 45}%` }} />
                                    <div className={cn("w-full rounded-b-full transition-all duration-300 opacity-60", active ? "bg-gradient-to-b from-[#FF512F] to-[#DD2476]" : "bg-white/5")} style={{ height: `${10 + h * 45}%` }} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Fixed Selection Overlay */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-30">
                    <div 
                        className="h-full border-x-4 border-white bg-white/[0.02] shadow-[0_0_120px_rgba(255,81,47,0.15)] relative pointer-events-auto"
                        style={{ width: `${trimDuration * PX_PER_SEC}px` }}
                        onPointerDown={(e) => handleDrag("scroll", e)}
                    >
                        {/* Handles */}
                        <div onPointerDown={(e) => { e.stopPropagation(); handleDrag("start", e); }} className="absolute inset-y-0 -left-1 w-2 cursor-ew-resize z-40 flex items-center justify-center group/h" >
                             <div className="w-[4px] h-14 bg-white/30 rounded-full group-hover/h:bg-white transition-all shadow-xl" />
                        </div>
                        <div onPointerDown={(e) => { e.stopPropagation(); handleDrag("end", e); }} className="absolute inset-y-0 -right-1 w-2 cursor-ew-resize z-40 flex items-center justify-center group/h" >
                             <div className="w-[4px] h-14 bg-white/30 rounded-full group-hover/h:bg-white transition-all shadow-xl" />
                        </div>

                        {/* Playhead */}
                        <div className="absolute inset-y-0 w-1 bg-white z-50 shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ left: `${((currentTime - start) / trimDuration) * 100}%` }} />
                        
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-black text-[8px] font-black px-4 py-1.5 rounded-full whitespace-nowrap uppercase tracking-widest ring-4 ring-black/20">
                            TRIM AUDIO
                        </div>
                    </div>
                </div>

                {/* Edge Blurs */}
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent z-40 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050505] via-[#050505]/60 to-transparent z-40 pointer-events-none" />
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-8">
                <div className="flex justify-center items-center gap-14 px-4">
                    <button
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        className="w-24 h-24 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_25px_60px_rgba(255,255,255,0.2)]"
                    >
                        {isPlaying ? <Pause className="w-12 h-12 text-black fill-black" /> : <Play className="w-12 h-12 text-black fill-black ml-1.5" />}
                    </button>

                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="w-24 h-24 bg-gradient-to-tr from-[#FF512F] to-[#DD2476] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl ring-4 ring-white/10"
                        >
                            <Check className="w-12 h-12 text-white stroke-[4]" />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-4 gap-3 px-4">
                    {[15, 30, 60, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => {
                                if (d <= duration) {
                                    setTrimDuration(d);
                                    trimRef.current = d;
                                    onTrimChange(start, start + d);
                                }
                            }}
                            className={cn(
                                "h-14 rounded-[1.25rem] text-[10px] font-black border transition-all",
                                trimDuration === d ? "bg-white text-black border-white shadow-xl translate-y-[-4px]" : "bg-white/5 text-zinc-500 border-white/10 hover:border-white/20"
                            )}
                        >
                            {d}S
                        </button>
                    ))}
                </div>
            </div>

            {/* Visual Flairs */}
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
}

