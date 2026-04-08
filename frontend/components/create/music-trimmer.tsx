"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Scissors, Play, Pause, Check, Loader2, Music2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; 
    onTrimChange: (start: number, end: number) => void;
    onConfirm?: () => void;
}

/**
 * ─── ConnectSphere-Zero Trimmer (v10) ───────────────────────────────────
 * DESIGN: 100% Instagram Copy (Scroll-based)
 * ENGINE: RAM-Safe Streaming (HTMLAudio) + Data-Efficient Waveform
 * PHILOSOPHY: Zero data waste, Zero RAM explosions, 100% Elite Feel.
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration = 30, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    // ─── Component State ───────────────────────────────────────────────
    const [start, setStart] = useState(0);
    const [trimDuration, setTrimDuration] = useState(Math.min(30, duration));
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─── Refs (Zero-Lag Interaction) ───────────────────────────────────
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const startRef = useRef(0);
    const durationRef = useRef(30);
    const raftRef = useRef<number | null>(null);
    
    // Config
    const PX_PER_SEC = 60; // Density
    const VIEWPORT_WIDTH = 300; // Fixed visual width of the selection window

    // Sync Refs to State
    useEffect(() => {
        startRef.current = start;
        durationRef.current = trimDuration;
    }, [start, trimDuration]);

    // ─── Smart Waveform Generator (RAM Protected) ──────────────────────
    useEffect(() => {
        let discarded = false;
        const generateWaveform = async () => {
            if (!audioUrl) return;
            setIsLoading(true);

            try {
                // Fetch only first 1-2mb for peaks if needed, but for precision we fetch full
                // HOWEVER: To avoid RAM spike, we use a Low-Sample-Rate OfflineContext
                const res = await fetch(audioUrl);
                const arrayBuffer = await res.arrayBuffer();
                
                // LOW MEMORY DECODE: 8kHz is plenty for visuals
                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
                    1, 1, 8000
                ); 
                
                // Actually, browsers don't allow 1-sample buffers easily. 
                // We'll decode a downsampled version.
                const fullBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                const channelData = fullBuffer.getChannelData(0);
                
                const numBars = Math.floor(duration * 4); // 4 bars per sec
                const samplesPerBar = Math.floor(channelData.length / numBars);
                const newPeaks: number[] = [];

                for (let i = 0; i < numBars; i++) {
                    let max = 0;
                    const offset = i * samplesPerBar;
                    // Take only one in every 20 samples to save CPU
                    for (let j = 0; j < samplesPerBar; j += 20) {
                        const val = Math.abs(channelData[offset + j] || 0);
                        if (val > max) max = val;
                    }
                    newPeaks.push(Math.pow(max * 1.5, 0.8));
                }

                if (!discarded) {
                    setPeaks(newPeaks);
                    setIsLoading(false);
                }
            } catch (err) {
                console.warn("Waveform failed, using pseudo-peaks.");
                setPeaks(Array.from({ length: 150 }).map(() => 0.1 + Math.random() * 0.4));
                setIsLoading(false);
            }
        };

        generateWaveform();
        return () => { discarded = true; };
    }, [audioUrl, duration]);

    // ─── Unified Playback Logic (Data Efficient) ───────────────────────
    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        if (raftRef.current) cancelAnimationFrame(raftRef.current);
        setIsPlaying(false);
    }, []);

    const playAudio = useCallback(() => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        
        audio.currentTime = startRef.current;
        audio.play().catch(() => {});
        setIsPlaying(true);

        const sync = () => {
            setCurrentTime(audio.currentTime);
            // Looping logic
            if (audio.currentTime >= startRef.current + durationRef.current) {
                audio.currentTime = startRef.current;
            }
            raftRef.current = requestAnimationFrame(sync);
        };
        raftRef.current = requestAnimationFrame(sync);
    }, []);

    // ─── Interaction (Liquid Scroll) ──────────────────────────────────
    const handlePointerDown = (mode: "window" | "start" | "end", e: React.PointerEvent) => {
        e.preventDefault();
        stopAudio();
        
        const initialX = e.clientX;
        const initialS = startRef.current;
        const initialT = durationRef.current;

        const onMove = (mv: PointerEvent) => {
            const dx = mv.clientX - initialX;
            const dt = dx / PX_PER_SEC;

            if (mode === "window") {
                const ns = Math.max(0, Math.min(initialS - dt, duration - durationRef.current));
                setStart(ns);
                setCurrentTime(ns);
            } else if (mode === "start") {
                const ns = Math.max(0, Math.min(initialS + dt, initialS + initialT - 0.5));
                const nt = initialT - (ns - initialS);
                setStart(ns);
                setTrimDuration(nt);
                setCurrentTime(ns);
            } else if (mode === "end") {
                const nt = Math.max(0.5, Math.min(initialT + dt, duration - initialS));
                setTrimDuration(nt);
                setCurrentTime(initialS + nt);
            }
        };

        const onUp = () => {
            onTrimChange(startRef.current, startRef.current + durationRef.current);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            playAudio();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    // ─── Visual Calculations ──────────────────────────────────────────
    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    return (
        <div className="bg-zinc-950 border border-white/5 rounded-[2.5rem] p-6 space-y-6 shadow-2xl relative overflow-hidden group">
            {/* Hidden Audio Tag (The Engine) */}
            <audio 
                ref={audioRef} 
                src={audioUrl} 
                preload="metadata" 
                crossOrigin="anonymous" 
                className="hidden"
            />

            {/* Header */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl shadow-lg">
                        <Music2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-white/90">Edit Music</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">ConnectSphere Zero Engine</p>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
                    <span className="text-xs font-mono font-bold text-orange-400">{formatTime(start)}</span>
                    <span className="mx-2 text-zinc-700">/</span>
                    <span className="text-[10px] font-mono text-zinc-400">{trimDuration.toFixed(1)}s</span>
                </div>
            </div>

            {/* Viewport */}
            <div className="relative h-48 bg-zinc-900/40 rounded-[2rem] overflow-hidden border border-white/5 shadow-inner">
                {/* Rolling Waveform */}
                <div 
                    className="absolute inset-y-0 flex items-center will-change-transform z-10 p-8"
                    style={{ 
                        width: `${duration * PX_PER_SEC}px`,
                        transform: `translateX(calc(50% - ${(trimDuration * PX_PER_SEC) / 2}px - ${start * PX_PER_SEC}px))`
                    }}
                    onPointerDown={(e) => handlePointerDown("window", e)}
                >
                    <div className="flex items-end gap-[1.5px] px-2 h-24 w-full">
                        {peaks.map((h, i) => {
                            const timeAtBar = (i / peaks.length) * duration;
                            const active = timeAtBar >= start && timeAtBar <= start + trimDuration;
                            return (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "flex-1 rounded-full transition-all duration-300",
                                        active ? "bg-gradient-to-t from-orange-400 to-pink-500" : "bg-zinc-800"
                                    )}
                                    style={{ height: `${10 + h * 90}%` }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Fixed Selection Overlay */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-30">
                    <div 
                        className="h-full border-x-[4px] border-white/90 bg-white/5 shadow-[0_0_100px_rgba(255,165,0,0.1)] relative pointer-events-auto cursor-grab active:cursor-grabbing group/win"
                        style={{ width: `${trimDuration * PX_PER_SEC}px` }}
                        onPointerDown={(e) => handlePointerDown("window", e)}
                    >
                        {/* Handles */}
                        <div 
                            className="absolute inset-y-0 -left-2 w-4 cursor-ew-resize z-40" 
                            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown("start", e); }} 
                        />
                        <div 
                            className="absolute inset-y-0 -right-2 w-4 cursor-ew-resize z-40" 
                            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown("end", e); }} 
                        />

                        {/* Playhead */}
                        <div 
                            className="absolute inset-y-0 w-0.5 bg-orange-500 shadow-[0_0_15px_#f97316]"
                            style={{ left: `${((currentTime - start) / trimDuration) * 100}%` }}
                        />
                        
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-3 py-1 rounded-full shadow-xl opacity-0 group-hover/win:opacity-100 transition-opacity whitespace-nowrap">
                            DRAG TO TRIM
                        </div>
                    </div>
                </div>

                {isLoading && (
                    <div className="absolute inset-0 z-50 bg-zinc-950/90 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Optimizing Chunks</p>
                    </div>
                )}

                {/* Edge Blurs */}
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-zinc-950/80 to-transparent z-40 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950/80 to-transparent z-40 pointer-events-none" />
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-6">
                <div className="flex justify-center items-center gap-12">
                     <button
                        onClick={() => {
                            if (audioRef.current) {
                                audioRef.current.currentTime = 0;
                                setStart(0);
                                onTrimChange(0, trimDuration);
                            }
                        }}
                        className="p-4 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"
                    >
                        <Scissors className="w-6 h-6" />
                    </button>

                    <button
                        onClick={isPlaying ? stopAudio : playAudio}
                        className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all"
                    >
                        {isPlaying ? <Pause className="w-10 h-10 text-black fill-black" /> : <Play className="w-10 h-10 text-black fill-black ml-1" />}
                    </button>

                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="p-4 bg-gradient-to-tr from-orange-500 to-pink-600 rounded-full shadow-xl hover:scale-105 active:scale-90 transition-all"
                        >
                            <Check className="w-8 h-8 text-white stroke-[4]" />
                        </button>
                    )}
                </div>

                <div className="flex justify-center gap-3">
                    {[15, 30, 60, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => { if (d <= duration) setTrimDuration(d); }}
                            className={cn(
                                "px-6 py-2.5 rounded-2xl text-[10px] font-black border transition-all",
                                trimDuration === d ? "bg-white text-black border-white shadow-lg" : "bg-white/5 text-zinc-500 border-white/5 hover:border-white/10"
                            )}
                        >
                            {d}S
                        </button>
                    ))}
                </div>
            </div>

            {/* Ambient Flares */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
        </div>
    );
}

