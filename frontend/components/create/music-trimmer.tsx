"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Scissors, Play, Pause, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; // in seconds
    onTrimChange: (start: number, end: number) => void;
    maxTrimDuration?: number; // Optional, we will support unlimited if not strictly enforced
    onConfirm?: () => void;
}

/**
 * ─── Ultimate "Bawaal" Music Trimmer (v6) ───────────────────────────────
 * FIX: Removed "Trrr Trrr" stutter by pausing audio during drag.
 * Refined the sync and loop logic for maximum stability.
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(duration || 30);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAudioReady, setIsAudioReady] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs to avoid stale closures and track interaction state
    const startRef = useRef(0);
    const endRef = useRef(0);
    const draggingRef = useRef<'start' | 'end' | 'window' | null>(null);
    const wasPlayingRef = useRef(false);
    const lastSeekRef = useRef(0); // For throttling audio sync

    // Sync refs with state
    useEffect(() => {
        startRef.current = start;
        endRef.current = end;
    }, [start, end]);

    useEffect(() => {
        if (duration > 0 && end === 0) {
            setEnd(duration);
            endRef.current = duration;
        }
    }, [duration]);

    // ─── Waveform Generation ──────────────────────────────────────────
    useEffect(() => {
        let discarded = false;
        const generatePeaks = async () => {
            if (!audioUrl) return;
            setIsLoading(true);
            try {
                const response = await fetch(audioUrl, { mode: 'cors' }).catch(() => null);
                if (!response || !response.ok) throw new Error("Fetch failed");
                const arrayBuffer = await response.arrayBuffer();
                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                const audioCtx = new AudioContextClass();
                const sampleRate = 44100;
                const length = Math.max(10, Math.floor((duration || 30) * sampleRate));
                const offlineCtx = new OfflineAudioContext(1, length, sampleRate);
                const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                const channelData = audioBuffer.getChannelData(0);
                
                const numBars = 100;
                const samplesPerBar = Math.floor(channelData.length / numBars);
                const newPeaks: number[] = [];
                for (let i = 0; i < numBars; i++) {
                    const startSample = i * samplesPerBar;
                    let max = 0;
                    for (let j = 0; j < samplesPerBar; j++) {
                        const val = Math.abs(channelData[startSample + j] || 0);
                        if (val > max) max = val;
                    }
                    newPeaks.push(Math.pow(max * 1.2, 0.8));
                }
                if (!discarded) { setPeaks(newPeaks); setIsLoading(false); }
            } catch (err) {
                console.warn("Waveform Fallback:", err);
                const seed = audioUrl.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const pseudoRandom = (s: number) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
                const fallback = Array.from({ length: 100 }).map((_, i) => 0.2 + pseudoRandom(seed + i) * 0.6);
                if (!discarded) { setPeaks(fallback); setIsLoading(false); }
            }
        };
        generatePeaks();
        return () => { discarded = true; };
    }, [audioUrl, duration]);

    // ─── Audio Management ───────────────────────────────────────────────
    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";

        const safePlay = async () => {
            if (!audio) return;
            try {
                await new Promise(resolve => setTimeout(resolve, 0));
                await audio.play();
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error("Playback failed:", err);
            }
        };

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            // Dynamic Looping logic
            if (audio.currentTime >= endRef.current - 0.05) {
                audio.currentTime = startRef.current;
                if (!audio.paused) safePlay();
            }
            // Clamping with higher tolerance to prevent stutter during playback
            if (audio.currentTime < startRef.current - 0.5 && !draggingRef.current) {
                audio.currentTime = startRef.current;
            }
        };

        const onEnded = () => {
            audio.currentTime = startRef.current;
            if (!audio.paused) safePlay();
        };

        const onLoadedMetadata = () => {
            setIsAudioReady(true);
            if (audio.currentTime < startRef.current) audio.currentTime = startRef.current;
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);

        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.pause(); audio.src = ""; audioRef.current = null;
        };
    }, [audioUrl]);

    const togglePlay = async () => {
        if (!audioRef.current || !isAudioReady) return;
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
        } else {
            try {
                if (Math.abs(audio.currentTime - startRef.current) > 0.5 || audio.currentTime >= endRef.current) {
                    audio.currentTime = startRef.current;
                }
                await new Promise(resolve => setTimeout(resolve, 10));
                await audio.play();
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error("Playback failed:", err);
            }
        }
    };

    // ─── Interaction Logic (Stabilized) ──────────────────────────────
    const handlePointerDown = (type: "start" | "end" | "window", e: React.PointerEvent) => {
        e.preventDefault();
        draggingRef.current = type;
        
        const audio = audioRef.current;
        if (audio) {
            wasPlayingRef.current = !audio.paused;
            audio.pause(); 
            audio.muted = true; // Force total silence to avoid "scratched record" bursts during seek
        }

        const rect = containerRef.current!.getBoundingClientRect();
        const startX = e.clientX;
        const initialS = start;
        const initialE = end;

        const onPointerMove = (moveEvt: PointerEvent) => {
            if (!draggingRef.current) return;
            const deltaX = moveEvt.clientX - startX;
            const totalDur = (duration || initialE);
            const deltaTime = (deltaX / rect.width) * totalDur;
            
            if (draggingRef.current === "start") {
                const newS = Math.max(0, Math.min(initialS + deltaTime, end - 0.5));
                setStart(newS);
                
                // 🔥 THROTTLED SEEKING: Fast enough to catch timing, but silent and stable
                const now = Date.now();
                if (audio && now - lastSeekRef.current > 100) {
                    audio.currentTime = newS;
                    lastSeekRef.current = now;
                }
            } else if (draggingRef.current === "end") {
                const newE = Math.max(start + 0.5, Math.min(initialE + deltaTime, totalDur));
                setEnd(newE);

                const now = Date.now();
                if (audio && now - lastSeekRef.current > 100) {
                    audio.currentTime = newE - 2; // Preview near the end
                    lastSeekRef.current = now;
                }
            } else if (draggingRef.current === "window") {
                const winDur = initialE - initialS;
                const newS = Math.max(0, Math.min(initialS + deltaTime, totalDur - winDur));
                setStart(newS);
                setEnd(newS + winDur);

                const now = Date.now();
                if (audio && now - lastSeekRef.current > 100) {
                    audio.currentTime = newS;
                    lastSeekRef.current = now;
                }
            }
        };

        const onPointerUp = () => {
            draggingRef.current = null;
            onTrimChange(startRef.current, endRef.current);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            
            // Final sync and restore
            if (audio) {
                audio.currentTime = startRef.current;
                audio.muted = false; // Lift the silence
                if (wasPlayingRef.current) {
                    audio.play().catch(() => {});
                }
            }
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    };

    const formatTime = (sec: number) => {
        if (isNaN(sec) || !isFinite(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const trimDuration = end - start;
    const progress = trimDuration > 0 ? Math.max(0, Math.min(1, (currentTime - start) / trimDuration)) : 0;
    
    // Percentages for CSS
    const startPct = (duration > 0 ? (start / duration) : 0) * 100;
    const widthPct = (duration > 0 ? (trimDuration / duration) : 100) * 100;

    return (
        <div className="bg-zinc-950/90 border border-white/10 rounded-2xl p-4 space-y-4 backdrop-blur-2xl shrink-0 shadow-2xl relative overflow-hidden select-none">
            {/* Header */}
            <div className="flex items-center justify-between px-1 relative z-10">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-primary/80">Premium Flexible Trimmer</span>
                </div>
                <div className="text-[11px] font-mono text-primary font-black bg-primary/20 px-2 py-1 rounded-lg border border-primary/30">
                    {formatTime(start)} — {formatTime(end)}
                    <span className="text-zinc-600 ml-2">({trimDuration.toFixed(1)}s)</span>
                </div>
            </div>

            {/* Interactive Waveform Container */}
            <div 
                ref={containerRef}
                className="relative h-28 bg-black/40 rounded-xl border border-white/5 overflow-hidden flex items-center group touch-none mx-2 shadow-inner"
            >
                {/* Background Waveform (Static Full) */}
                <div className="absolute inset-x-0 inset-y-6 flex items-end gap-[1.5px] opacity-10 pointer-events-none px-4">
                    {peaks.map((h, i) => (
                        <div key={i} className="flex-1 rounded-full bg-white/40 shadow-sm" style={{ height: `${20 + h * 80}%` }} />
                    ))}
                </div>

                {/* THE HIGHLIGHTED DRAGGABLE WINDOW */}
                <div
                    className="absolute inset-y-0 border-y-2 border-primary/50 bg-primary/10 shadow-[0_0_40px_rgba(255,183,77,0.1)] cursor-grab active:cursor-grabbing z-20"
                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                    onPointerDown={(e) => handlePointerDown("window", e)}
                >
                    {/* Inner Progress Indicator */}
                    <div 
                        className="absolute inset-y-0 left-0 bg-primary/30 border-r-2 border-primary/60 shadow-[0_0_20px_rgba(255,183,77,0.3)] z-10 pointer-events-none"
                        style={{ width: `${progress * 100}%` }}
                    />

                    {/* Bright Waveform Fragment (Nested with Math for exact sync) */}
                    <div 
                        className="absolute inset-y-6 flex items-end gap-[1.5px] pointer-events-none px-4 overflow-hidden"
                        style={{
                            left: `-${(start / trimDuration) * 100}%`,
                            width: `${(duration / trimDuration) * 100}%`
                        }}
                    >
                        {peaks.map((h, i) => (
                            <div key={i} className="flex-1 rounded-full bg-primary shadow-[0_0_10px_rgba(255,183,77,0.5)]" style={{ height: `${20 + h * 80}%` }} />
                        ))}
                    </div>

                    {/* Left Handle */}
                    <div
                        className="absolute inset-y-0 -left-4 w-8 flex items-center justify-center cursor-ew-resize z-30 group/handle"
                        onPointerDown={(e) => { e.stopPropagation(); handlePointerDown("start", e); }}
                    >
                        <div className="w-1.5 h-14 bg-white rounded-full shadow-[0_0_20px_white] ring-8 ring-black/20 group-active/handle:scale-125 transition-transform" />
                    </div>

                    {/* Right Handle */}
                    <div
                        className="absolute inset-y-0 -right-4 w-8 flex items-center justify-center cursor-ew-resize z-30 group/handle"
                        onPointerDown={(e) => { e.stopPropagation(); handlePointerDown("end", e); }}
                    >
                        <div className="w-1.5 h-14 bg-primary rounded-full shadow-[0_0_20px_rgba(255,183,77,1)] ring-8 ring-black/20 group-active/handle:scale-125 transition-transform" />
                    </div>

                    {/* Current Playback Marker (Vertical line inside box) */}
                    <div 
                        className="absolute inset-y-0 z-40 w-[2px] bg-white shadow-[0_0_10px_white]"
                        style={{ left: `${progress * 100}%` }}
                    />

                    {/* Floating Time Label */}
                    <div className="absolute top-1 left-4 text-[9px] font-mono font-bold text-white uppercase drop-shadow-lg z-30 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">
                        {formatTime(currentTime)}
                    </div>
                </div>

                {isLoading && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Mastering Waveform...</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center gap-12 relative z-10 pt-2">
                <button
                    onClick={togglePlay}
                    disabled={!isAudioReady}
                    className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 shadow-[0_0_30px_rgba(0,0,0,0.5)] group disabled:opacity-50"
                >
                    {isPlaying ? (
                        <Pause className="w-8 h-8 text-primary fill-primary filter drop-shadow-[0_0_8px_rgba(255,183,77,0.5)]" />
                    ) : (
                        <Play className="w-8 h-8 text-white fill-white ml-1 group-hover:text-primary transition-colors" />
                    )}
                </button>
                
                {onConfirm && (
                    <button
                        onClick={onConfirm}
                        className="w-16 h-16 bg-primary/20 border border-primary/40 rounded-full flex items-center justify-center hover:bg-primary/30 transition-all active:scale-90 shadow-[0_0_30px_rgba(255,183,77,0.2)]"
                    >
                        <Check className="w-8 h-8 text-primary stroke-[4]" />
                    </button>
                )}
            </div>

            <p className="text-center text-[9px] font-mono text-zinc-600 uppercase tracking-[0.4em] pt-2 animate-pulse">
                Drag to move selection · Grab edges to resize clip
            </p>
        </div>
    );
}
