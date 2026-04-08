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
 * ─── ConnectSphere-Masterpiece (v14) ──────────────────────────────────
 * THE ULTIMATE PREMIUM TRIMMER
 * Visuals: Mirrored Pulse + Progressive Glow + Dynamic Fluid Waves
 * Interaction: Fully Flexible Centered-Resize Handles (Kam/Jyada)
 * UX: Floating Tooltips + Glassmorphic UI
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration = 30, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    // ─── State ────────────────────────────────────────────────────────
    const [start, setStart] = useState(0);
    const [trimDuration, setTrimDuration] = useState(Math.min(15, duration));
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isDecoding, setIsDecoding] = useState(true);

    // ─── Refs ─────────────────────────────────────────────────────────
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const startRef = useRef(0);
    const trimRef = useRef(15);
    const raftRef = useRef<number | null>(null);
    const isInteractingRef = useRef(false);

    const PX_PER_SEC = 60; // Slightly higher resolution
    const totalWaveformWidth = duration * PX_PER_SEC;

    // Sync refs
    useEffect(() => {
        startRef.current = start;
        trimRef.current = trimDuration;
    }, [start, trimDuration]);

    // ─── Phase 1: High-Performance Peak Sampler ───────────────────────
    useEffect(() => {
        // Immediate Seeded Waves (Never show black)
        const seed = Array.from({ length: 200 }).map((_, i) => 
            0.15 + (Math.sin(i * 0.25) * 0.1) + (Math.random() * 0.25)
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
                    const bars = Math.floor(duration * 5); // Higher density for premium look
                    const step = Math.floor(data.length / bars);
                    const p: number[] = [];
                    for (let i = 0; i < bars; i++) {
                        let m = 0;
                        for (let j = 0; j < step; j += 60) {
                            const v = Math.abs(data[i * step + j] || 0);
                            if (v > m) m = v;
                        }
                        p.push(Math.pow(m * 1.8, 0.75));
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

    // ─── Phase 2: Professional Playback Engine ────────────────────────
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
            // Boundary Looping
            if (audio.currentTime >= eTime || audio.currentTime < sTime - 0.2) {
                audio.currentTime = sTime;
            }
            raftRef.current = requestAnimationFrame(syncLoop);
        };
        raftRef.current = requestAnimationFrame(syncLoop);
    }, []);

    // ─── Phase 3: Master Interaction (Resizing + Scrolling) ───────────
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
                // Change start, keep end fixed (Flexible Resize)
                news = Math.max(0, Math.min(initialS + dt, initialS + initialT - 0.5));
                newt = initialT - (news - initialS);
            } else if (type === "end") {
                // Change end, keep start fixed (Flexible Resize)
                newt = Math.max(0.5, Math.min(initialT + dt, duration - initialS));
            }

            setStart(news);
            setTrimDuration(newt);
            setCurrentTime(news);
            startRef.current = news;
            trimRef.current = newt;
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
        <div className="bg-[#050505] border border-white/5 rounded-[3rem] p-6 space-y-8 shadow-2xl relative overflow-hidden select-none group">
            <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" preload="metadata" className="hidden" />

            {/* Header (Premium Glass) */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#FF512F] blur-lg opacity-20 animate-pulse" />
                        <div className="relative p-3 bg-gradient-to-tr from-[#FF512F] to-[#DD2476] rounded-[1.25rem] shadow-xl ring-1 ring-white/20">
                            <Music2 className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white/90 tracking-tight leading-none mb-1">Editor Pro</h3>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">{isDecoding ? "Analyzing Waves" : "Frequency Ready"}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-[1.25rem] backdrop-blur-xl flex items-baseline gap-1.5 shadow-lg">
                    <span className="text-sm font-mono font-black text-[#FF512F]">{formatTime(start)}</span>
                    <span className="text-xs font-mono text-zinc-700">/</span>
                    <span className="text-[11px] font-mono font-bold text-zinc-400">{trimDuration.toFixed(1)}s</span>
                </div>
            </div>

            {/* Viewport - THE MASTER ENGINE */}
            <div className="relative h-56 bg-[#080808] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] flex items-center">
                
                {/* Visual Depth Grids */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                {/* Rolling Waveform Mirrored Pulses */}
                <div 
                    className="flex items-center h-full will-change-transform z-10 cursor-grab active:cursor-grabbing px-[50%]"
                    style={{ 
                        width: `${totalWaveformWidth}px`,
                        transform: `translateX(calc(-${(trimDuration * PX_PER_SEC) / 2}px - ${start * PX_PER_SEC}px))`
                    }}
                    onPointerDown={(e) => handleDrag("scroll", e)}
                >
                    <div className="flex items-center gap-[4px] h-full">
                        {peaks.map((h, i) => {
                            const time = (i / peaks.length) * duration;
                            const isActive = time >= start && time <= start + trimDuration;
                            const isPlayed = time < currentTime;
                            
                            return (
                                <div key={i} className="flex flex-col items-center gap-[3px] h-40 w-[4px]">
                                    <div 
                                        className={cn(
                                            "w-full rounded-t-full transition-all duration-300",
                                            isActive 
                                                ? (isPlayed ? "bg-white shadow-[0_0_15px_white]" : "bg-gradient-to-t from-[#FF512F] to-[#DD2476]") 
                                                : "bg-white/5"
                                        )} 
                                        style={{ height: `${10 + h * 45}%` }} 
                                    />
                                    <div 
                                        className={cn(
                                            "w-full rounded-b-full transition-all duration-300 opacity-30",
                                            isActive 
                                                ? (isPlayed ? "bg-white/80" : "bg-gradient-to-b from-[#FF512F] to-[#DD2476]") 
                                                : "bg-white/[0.02]"
                                        )} 
                                        style={{ height: `${10 + h * 45}%` }} 
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Fixed Active Window (Flexible) */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-30">
                    <div 
                        className="h-full border-x-[4px] border-white bg-white/[0.04] shadow-[0_0_150px_rgba(255,81,47,0.1)] relative pointer-events-auto backdrop-blur-[2px]"
                        style={{ width: `${trimDuration * PX_PER_SEC}px` }}
                    >
                        {/* LEFT HANDLE ( Kam / Jyada ) */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("start", e); }} 
                            className="absolute inset-y-0 -left-3 w-6 cursor-ew-resize z-40 flex items-center justify-center group/h" 
                        >
                            <div className="w-[5px] h-16 bg-white/40 rounded-full group-hover/h:bg-white group-hover/h:scale-x-125 transition-all shadow-[0_0_30px_white]" />
                            {/* Floating Label */}
                            <div className="absolute -top-10 left-0 bg-white text-black text-[9px] font-black px-2 py-1 rounded-md opacity-0 group-hover/h:opacity-100 transition-opacity whitespace-nowrap shadow-2xl uppercase">
                                Start: {formatTime(start)}
                            </div>
                        </div>

                        {/* RIGHT HANDLE ( Kam / Jyada ) */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("end", e); }} 
                            className="absolute inset-y-0 -right-3 w-6 cursor-ew-resize z-40 flex items-center justify-center group/h" 
                        >
                            <div className="w-[5px] h-16 bg-white/40 rounded-full group-hover/h:bg-white group-hover/h:scale-x-125 transition-all shadow-[0_0_30px_white]" />
                            {/* Floating Label */}
                            <div className="absolute -top-10 right-0 bg-white text-black text-[9px] font-black px-2 py-1 rounded-md opacity-0 group-hover/h:opacity-100 transition-opacity whitespace-nowrap shadow-2xl uppercase">
                                End: {formatTime(start + trimDuration)}
                            </div>
                        </div>

                        {/* PLAYHEAD (Glow effect) */}
                        <div className="absolute inset-y-0 w-1.5 bg-white z-50 shadow-[0_0_25px_rgba(255,255,255,1)]" style={{ left: `${((currentTime - start) / trimDuration) * 100}%` }}>
                            <div className="absolute -top-1 -left-1 w-3 h-3 bg-white rounded-full shadow-[0_0_15px_white]" />
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white rounded-full shadow-[0_0_15px_white]" />
                        </div>
                        
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[8px] font-black px-5 py-2 rounded-full whitespace-nowrap uppercase tracking-[0.25em] shadow-[0_10px_40px_rgba(255,255,255,0.2)]">
                            Selection Window
                        </div>
                    </div>
                </div>

                {/* Depth Masks */}
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#050505] via-[#050505]/40 to-transparent z-40 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050505] via-[#050505]/40 to-transparent z-40 pointer-events-none" />
            </div>

            {/* Premium Controls */}
            <div className="flex flex-col gap-10 pb-4">
                <div className="flex justify-center items-center gap-16">
                    <button
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        className="w-24 h-24 bg-white rounded-full flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_25px_60px_rgba(255,255,255,0.25)] ring-8 ring-white/10"
                    >
                        {isPlaying ? <Pause className="w-11 h-11 text-black fill-black" /> : <Play className="w-11 h-11 text-black fill-black ml-1.5" />}
                    </button>

                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="w-24 h-24 bg-gradient-to-br from-[#FF512F] via-[#DD2476] to-[#ad1d5e] rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl ring-8 ring-pink-500/10 active:ring-0"
                        >
                            <Check className="w-12 h-12 text-white stroke-[4]" />
                        </button>
                    )}
                </div>

                {/* Smart Presets */}
                <div className="grid grid-cols-4 gap-4 px-2">
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
                                "h-14 rounded-3xl text-[10px] font-black border transition-all uppercase tracking-widest relative overflow-hidden",
                                trimDuration === d 
                                    ? "bg-white text-black border-white shadow-[0_15px_35px_rgba(255,255,255,0.1)] translate-y-[-4px]" 
                                    : "bg-white/5 text-zinc-600 border-white/5 hover:border-white/10 hover:text-zinc-400"
                            )}
                        >
                            {trimDuration === d && (
                                <div className="absolute inset-0 bg-white/10 animate-ripple pointer-events-none" />
                            )}
                            {d}S
                        </button>
                    ))}
                </div>
            </div>

            {/* Aesthetics Background */}
            <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[160px] pointer-events-none" />
            <div className="absolute -top-60 -left-60 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[160px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#FF512F]/[0.01] blur-[200px] pointer-events-none" />
        </div>
    );
}

