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
 * ─── ConnectSphere-Pro Trimmer (v13 - ELITE) ───────────────────────────
 * DESIGN: Instagram 1:1 Scroll Engine
 * FIX: Centered Fixed Selection Port (Prevents off-screen bug)
 * PERF: Super-lightweight CSS visuals (No complex shadows)
 * DATA: Zero-buffer streaming logic
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration = 30, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    // ─── Core State ──────────────────────────────────────────────────
    const [start, setStart] = useState(0);
    const [trimDuration, setTrimDuration] = useState(Math.min(15, duration)); // Use smaller default for better UX
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isDecoding, setIsDecoding] = useState(true);

    // ─── High-Speed Refs ─────────────────────────────────────────────
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const startRef = useRef(0);
    const trimRef = useRef(15);
    const raftRef = useRef<number | null>(null);
    const isInteractingRef = useRef(false);

    // Fixed Dimensions (Instagram Standard)
    const PX_PER_SEC = 50; 
    const totalWaveformWidth = duration * PX_PER_SEC;

    // Sync state to refs
    useEffect(() => {
        startRef.current = start;
        trimRef.current = trimDuration;
    }, [start, trimDuration]);

    // ─── Waveform Pulse Logic (Mirrored & Fast) ──────────────────────
    useEffect(() => {
        // Instant Fallback (No Black Screens)
        const fallback = Array.from({ length: 150 }).map((_, i) => 
            0.2 + (Math.sin(i * 0.3) * 0.1) + (Math.random() * 0.2)
        );
        setPeaks(fallback);
        
        let active = true;
        const decode = async () => {
            if (!audioUrl) return;
            try {
                // Lean Scan (Range request for poor networks)
                const res = await fetch(audioUrl, { headers: { 'Range': 'bytes=0-5000000' } }).catch(() => fetch(audioUrl));
                const blob = await res.arrayBuffer();
                const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
                const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
                const buffer = await offline.decodeAudioData(blob);
                
                if (active) {
                    const data = buffer.getChannelData(0);
                    const bars = 150; // Fixed visual density
                    const step = Math.floor(data.length / bars);
                    const p: number[] = [];
                    for (let i = 0; i < bars; i++) {
                        let m = 0;
                        for (let j = 0; j < step; j += 100) {
                            const v = Math.abs(data[i * step + j] || 0);
                            if (v > m) m = v;
                        }
                        p.push(Math.pow(m * 2, 0.7));
                    }
                    setPeaks(p);
                }
            } catch (e) {
                console.warn("Visuals using smooth pulse fallback.");
            } finally {
                if (active) setIsDecoding(false);
            }
        };
        decode();
        return () => { active = false; };
    }, [audioUrl, duration]);

    // ─── Playback Looping Engine ─────────────────────────────────────
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
            // Looping logic
            if (audio.currentTime >= eTime || audio.currentTime < sTime - 0.2) {
                audio.currentTime = sTime;
            }
            raftRef.current = requestAnimationFrame(syncLoop);
        };
        raftRef.current = requestAnimationFrame(syncLoop);
    }, []);

    // ─── Instagram Interaction Logic (Fixed Center Window) ────────────
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
                // Move gane (negative delta)
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
        <div className="bg-[#050505] border border-white/5 rounded-[2.5rem] p-6 space-y-6 shadow-2xl relative overflow-hidden select-none group">
            <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" preload="metadata" className="hidden" />

            {/* Header */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-tr from-[#FF512F] to-[#DD2476] rounded-2xl shadow-lg ring-1 ring-white/10">
                        <Music2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-black text-sm text-white tracking-tight uppercase italic underline decoration-orange-500 decoration-2 underline-offset-4">Elite Trimmer</h3>
                        <p className="text-[8px] text-zinc-500 font-bold tracking-widest">{isDecoding ? "SAMPLING..." : "STREAMING READY"}</p>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-2xl backdrop-blur-md flex items-baseline gap-1">
                    <span className="text-xs font-mono font-bold text-orange-400">{formatTime(start)}</span>
                    <span className="text-[10px] font-mono text-zinc-600">/</span>
                    <span className="text-[10px] font-mono text-zinc-400">{trimDuration.toFixed(1)}s</span>
                </div>
            </div>

            {/* Viewport - THE VIRTUAL SCROLL */}
            <div className="relative h-44 bg-[#0a0a0a] rounded-[2rem] overflow-hidden border border-white/5 shadow-inner flex items-center box-content">
                {/* Rolling Waveform Mirrored Pulses */}
                <div 
                    className="flex items-center h-full will-change-transform z-10 cursor-grab active:cursor-grabbing px-[50%]"
                    style={{ 
                        width: `${totalWaveformWidth}px`,
                        transform: `translateX(calc(-${(trimDuration * PX_PER_SEC) / 2}px - ${start * PX_PER_SEC}px))`
                    }}
                    onPointerDown={(e) => handleDrag("scroll", e)}
                >
                    <div className="flex items-center gap-[3px] h-full">
                        {peaks.map((h, i) => {
                            const time = (i / peaks.length) * duration;
                            const active = time >= start && time <= start + trimDuration;
                            return (
                                <div key={i} className="flex flex-col items-center gap-[2px] h-28 w-[4px]">
                                    <div className={cn("w-full rounded-t-full transition-all duration-300", active ? "bg-gradient-to-t from-[#FF512F] to-[#DD2476]" : "bg-white/10")} style={{ height: `${10 + h * 40}%` }} />
                                    <div className={cn("w-full rounded-b-full transition-all duration-300 opacity-40", active ? "bg-gradient-to-b from-[#FF512F] to-[#DD2476]" : "bg-white/5")} style={{ height: `${10 + h * 40}%` }} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Fixed Selection Overlay (Centered) */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-30">
                    <div 
                        className="h-full border-x-[3px] border-white/80 bg-white/[0.03] shadow-[0_0_100px_rgba(255,255,255,0.05)] relative pointer-events-auto"
                        style={{ width: `${trimDuration * PX_PER_SEC}px` }}
                        onPointerDown={(e) => handleDrag("scroll", e)}
                    >
                        {/* Handles (Gareeb-Friendly Touch Area) */}
                        <div onPointerDown={(e) => { e.stopPropagation(); handleDrag("start", e); }} className="absolute inset-y-0 -left-2 w-4 cursor-ew-resize z-40 flex items-center justify-center group/h" >
                             <div className="w-[4px] h-14 bg-white/20 rounded-full group-hover/h:bg-white transition-all shadow-xl" />
                        </div>
                        <div onPointerDown={(e) => { e.stopPropagation(); handleDrag("end", e); }} className="absolute inset-y-0 -right-2 w-4 cursor-ew-resize z-40 flex items-center justify-center group/h" >
                             <div className="w-[4px] h-14 bg-white/20 rounded-full group-hover/h:bg-white transition-all shadow-xl" />
                        </div>

                        {/* Playhead */}
                        <div className="absolute inset-y-0 w-1 bg-white z-50 shadow-[0_0_20px_white]" style={{ left: `${((currentTime - start) / trimDuration) * 100}%` }} />
                        
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-black text-[7px] font-black px-4 py-1.5 rounded-full whitespace-nowrap uppercase tracking-[0.2em] shadow-2xl">
                            ADJUST CLIP
                        </div>
                    </div>
                </div>

                {/* Gradient Masks */}
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050505] to-transparent z-40 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050505] to-transparent z-40 pointer-events-none" />
            </div>

            {/* Lower Controls */}
            <div className="flex flex-col gap-6">
                <div className="flex justify-center items-center gap-14 pt-2">
                    <button
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-90 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.15)] group"
                    >
                        {isPlaying ? <Pause className="w-10 h-10 text-black fill-black" /> : <Play className="w-10 h-10 text-black fill-black ml-1.5" />}
                    </button>

                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="w-20 h-20 bg-gradient-to-tr from-[#FF512F] to-[#DD2476] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl ring-2 ring-white/10"
                        >
                            <Check className="w-10 h-10 text-white stroke-[3.5]" />
                        </button>
                    )}
                </div>

                <div className="flex justify-center gap-2.5 px-2">
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
                                "flex-1 h-12 rounded-2xl text-[9px] font-black border transition-all uppercase tracking-tighter",
                                trimDuration === d ? "bg-white text-black border-white shadow-xl translate-y-[-2px]" : "bg-white/5 text-zinc-500 border-white/5 hover:border-white/10"
                            )}
                        >
                            {d}S Clip
                        </button>
                    ))}
                </div>
            </div>

            {/* Visual Flairs */}
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
}
