"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Scissors, Play, Pause, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; // in seconds
    onTrimChange: (start: number, end: number) => void;
    maxTrimDuration?: number; // Ignored as per user request to be flexible
    onConfirm?: () => void;
}

/**
 * ─── Ultimate Flexible Music Trimmer ─────────────────────────────────────
 * Completely custom, robust drag logic and detached audio state for gapless playback.
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    // Initial state encompasses the entire song, no 30s limits.
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(duration || 30);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [loadingPeaks, setLoadingPeaks] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs for drag and audio logic
    const startRef = useRef(start);
    const endRef = useRef(end);
    const draggingRef = useRef<'start' | 'end' | 'window' | null>(null);
    const dragStartXRef = useRef(0);
    const initialStartRef = useRef(0);
    const initialEndRef = useRef(0);

    // Keep refs synced with state
    useEffect(() => {
        startRef.current = start;
        endRef.current = end;
    }, [start, end]);

    // Update 'end' when 'duration' becomes available (e.g. initially 0)
    useEffect(() => {
        if (duration > 0 && end === 0) {
            setEnd(duration);
            endRef.current = duration;
        }
    }, [duration]);

    // ─── Waveform Generation ──────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const generatePeaks = async () => {
            if (!audioUrl) return;
            setLoadingPeaks(true);
            try {
                const response = await fetch(audioUrl, { mode: 'cors' }).catch(() => null);
                if (!response || !response.ok) throw new Error("Fetch failed");
                const arrayBuffer = await response.arrayBuffer();
                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                const audioCtx = new AudioContextClass();
                const sampleRate = 44100;
                const length = Math.floor((duration || 30) * sampleRate);
                const offlineCtx = new OfflineAudioContext(1, length > 0 ? length : 1, sampleRate);
                const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                const channelData = audioBuffer.getChannelData(0);
                const numBars = 100; // More bars for a fluid look
                const samplesPerBar = Math.floor(channelData.length / numBars);
                const newPeaks: number[] = [];
                for (let i = 0; i < numBars; i++) {
                    const startSample = i * samplesPerBar;
                    let max = 0;
                    for (let j = 0; j < samplesPerBar; j++) {
                        const val = Math.abs(channelData[startSample + j] || 0);
                        if (val > max) max = val;
                    }
                    newPeaks.push(Math.pow(max, 0.8));
                }
                if (!cancelled) { setPeaks(newPeaks); setLoadingPeaks(false); }
            } catch (err) {
                console.warn("Waveform fallback used.");
                const seed = audioUrl.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const pseudoRandom = (s: number) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
                const fallback = Array.from({ length: 100 }).map((_, i) => 0.2 + pseudoRandom(seed + i) * 0.6);
                if (!cancelled) { setPeaks(fallback); setLoadingPeaks(false); }
            }
        };
        generatePeaks();
        return () => { cancelled = true; };
    }, [audioUrl, duration]);

    // ─── Audio Core ──────────────────────────────────────────────────
    // WARNING: Run this only ONCE per audioUrl. Do NOT add `start` or `end` to deps.
    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.preload = "auto";
        
        let playPromise: Promise<void> | null = null;

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            const currentStart = startRef.current;
            const currentEnd = endRef.current;
            
            // Loop Logic
            if (audio.currentTime >= currentEnd - 0.05) {
                audio.currentTime = currentStart;
                if (!audio.paused) {
                    playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(() => {});
                    }
                }
            }
            if (audio.currentTime < currentStart - 0.1) {
                audio.currentTime = currentStart;
            }
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onCanPlay = () => {
             // If we just loaded the audio and it's 0, set it to start, but don't force play
             if (audio.currentTime < startRef.current) {
                 audio.currentTime = startRef.current;
             }
        };

        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("canplay", onCanPlay);

        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("canplay", onCanPlay);
            audio.pause();
            audio.src = "";
            audioRef.current = null;
        };
    }, [audioUrl]); // Dependency array MUST ONLY contain audioUrl to prevent object recreation

    const togglePlay = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        if (isPlaying) { 
            audio.pause(); 
        } else {
            // Ensure we are within bounds before playing
            if (audio.currentTime < startRef.current || audio.currentTime >= endRef.current) {
                audio.currentTime = startRef.current;
            }
            audio.play().catch(() => {});
        }
    };

    // ─── Solid Pointer Drag Logic ────────────────────────────────────
    const handlePointerDown = (type: "start" | "end" | "window", e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!containerRef.current) return;
        const target = e.target as HTMLElement;
        target.setPointerCapture(e.pointerId);

        draggingRef.current = type;
        dragStartXRef.current = e.clientX;
        initialStartRef.current = startRef.current;
        initialEndRef.current = endRef.current;

        const onPointerMove = (moveEvt: PointerEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const deltaX = moveEvt.clientX - dragStartXRef.current;
            const deltaTime = (deltaX / rect.width) * duration;
            
            let newStart = initialStartRef.current;
            let newEnd = initialEndRef.current;
            const minTrim = 1.0; // Minimum 1 second allowed

            if (draggingRef.current === "start") {
                newStart = Math.min(Math.max(0, newStart + deltaTime), newEnd - minTrim);
            } else if (draggingRef.current === "end") {
                newEnd = Math.max(Math.min(duration, newEnd + deltaTime), newStart + minTrim);
            } else if (draggingRef.current === "window") {
                const winDur = newEnd - newStart;
                let proposedStart = newStart + deltaTime;
                if (proposedStart < 0) {
                    proposedStart = 0;
                } else if (proposedStart + winDur > duration) {
                    proposedStart = duration - winDur;
                }
                newStart = proposedStart;
                newEnd = proposedStart + winDur;
            }

            setStart(newStart);
            setEnd(newEnd);

            // Sync audio immediately for 'start' or 'window' dragging to provide audio feedback
            if (audioRef.current && (draggingRef.current === "start" || draggingRef.current === "window")) {
                if (Math.abs(audioRef.current.currentTime - newStart) > 0.1) {
                    audioRef.current.currentTime = newStart;
                }
            }
        };

        const onPointerUp = (upEvt: PointerEvent) => {
            target.releasePointerCapture(upEvt.pointerId);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            draggingRef.current = null;
            onTrimChange(startRef.current, endRef.current);
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
    
    // Convert to percentages for styling
    const durationSafe = duration > 0 ? duration : 1;
    const startObjPercent = (start / durationSafe) * 100;
    const endObjPercent = (end / durationSafe) * 100;
    const widthPercent = endObjPercent - startObjPercent;

    return (
        <div className="bg-zinc-950/90 border border-white/10 rounded-2xl p-4 space-y-4 backdrop-blur-2xl shrink-0 shadow-2xl relative overflow-hidden group/trimmer">
            {/* Header */}
            <div className="flex items-center justify-between px-1 relative z-10">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-primary/80">FLEXIBLE EDITOR</span>
                </div>
                <div className="text-[11px] font-mono text-primary font-black bg-primary/20 px-2 py-1 rounded-lg border border-primary/30">
                    {formatTime(start)} — {formatTime(end)}
                    <span className="text-zinc-600 ml-2">({trimDuration.toFixed(1)}s)</span>
                </div>
            </div>

            {/* Trimmer Container */}
            <div 
                ref={containerRef}
                className="relative h-24 bg-black/40 rounded-xl border border-white/5 overflow-hidden flex items-center select-none touch-none"
            >
                {/* Waveform Background (Static Full Length) */}
                <div className="absolute inset-x-0 inset-y-4 flex items-end gap-[1px] opacity-20 pointer-events-none px-2">
                    {peaks.map((h, i) => (
                        <div key={i} className="flex-1 rounded-full bg-white" style={{ height: `${20 + h * 80}%` }} />
                    ))}
                </div>

                {/* THE MOVABLE SELECTION BOX */}
                <div
                    className="absolute inset-y-0 z-20 cursor-grab active:cursor-grabbing border-y-2 border-primary/40 bg-primary/5"
                    style={{ 
                        left: `${startObjPercent}%`,
                        width: `${widthPercent}%` 
                    }}
                    onPointerDown={(e) => handlePointerDown("window", e)}
                >
                    {/* YELLOW PROGRESS METER */}
                    <div 
                        className="absolute inset-y-0 left-0 bg-primary/30 border-r border-primary/50 shadow-[0_0_20px_rgba(255,183,77,0.2)]"
                        style={{ width: `${progress * 100}%` }}
                    />

                    {/* WAVEFORM INSIDE BOX (Bright) */}
                    {/* Since this div is positioned at `startObjPercent` width `widthPercent`, we need to position the peaks array absolutely relative to the container, OR clip the container. Clipping is better. */}
                    <div 
                        className="absolute inset-y-4 flex items-end gap-[1px] pointer-events-none"
                        style={{
                            // Shift the peaks left by exactly the start percentage relative to the *whole* container
                            // But since we are inside a element of width %, we need intricate math. Let's just render the peaks!
                            left: `-${(start / trimDuration) * 100}%`,
                            width: `${(duration / trimDuration) * 100}%`,
                            padding: '0 8px' // match parent px-2
                        }}
                    >
                        {peaks.map((h, i) => (
                            <div key={i} className="flex-1 rounded-full bg-primary shadow-[0_0_8px_rgba(255,183,77,0.5)]" style={{ height: `${20 + h * 80}%` }} />
                        ))}
                    </div>

                    {/* Draggable Handle (Left) */}
                    <div
                        className="absolute inset-y-0 -left-3 w-6 cursor-ew-resize flex items-center justify-center z-30 group/handle"
                        onPointerDown={(e) => handlePointerDown("start", e)}
                    >
                        <div className="w-1.5 h-12 bg-white rounded-full shadow-[0_0_15px_white] ring-4 ring-black/50 group-active/handle:scale-110 transition-transform" />
                    </div>

                    {/* Draggable Handle (Right) */}
                    <div
                        className="absolute inset-y-0 -right-3 w-6 cursor-ew-resize flex items-center justify-center z-30 group/handle"
                        onPointerDown={(e) => handlePointerDown("end", e)}
                    >
                        <div className="w-1.5 h-12 bg-primary rounded-full shadow-[0_0_15px_rgba(255,183,77,1)] ring-4 ring-black/50 group-active/handle:scale-110 transition-transform" />
                    </div>

                    {/* Current Time Label inside box */}
                    <div className="absolute top-1 left-3 text-[9px] font-mono text-primary/80 font-bold uppercase tracking-tighter drop-shadow-md">
                        {formatTime(currentTime)}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center gap-10">
                <button
                    onClick={togglePlay}
                    className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 shadow-2xl"
                >
                    {isPlaying ? (
                        <Pause className="w-8 h-8 text-primary fill-primary" />
                    ) : (
                        <Play className="w-8 h-8 text-white fill-white ml-2" />
                    )}
                </button>
                
                {onConfirm && (
                    <button
                        onClick={onConfirm}
                        className="w-16 h-16 bg-primary/20 border border-primary/40 rounded-2xl flex items-center justify-center hover:bg-primary/30 transition-all active:scale-90 shadow-xl text-primary"
                    >
                        <Check className="w-8 h-8 stroke-[4]" />
                    </button>
                )}
            </div>

            <p className="text-center text-[9px] font-mono text-zinc-600 uppercase tracking-[0.4em] pt-2">
                Drag box to move · Pull edges to stretch unlimited
            </p>
        </div>
    );
}

