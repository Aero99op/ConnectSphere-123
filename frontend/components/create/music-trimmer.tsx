"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Scissors, Play, Pause, Check, Loader2 } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; // in seconds
    onTrimChange: (start: number, end: number) => void;
    maxTrimDuration?: number;
    onConfirm?: () => void;
}

/**
 * ─── Elite Draggable Multi-Slider Music Trimmer ────────────────────────
 * EXACTLY LIKE INSTAGRAM & PRO APPS.
 * Handlers are draggable, window is movable, and entire waveform is visible.
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration, 
    onTrimChange, 
    maxTrimDuration = 30, 
    onConfirm 
}: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [trimDuration, setTrimDuration] = useState(Math.min(duration, maxTrimDuration));
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [loadingPeaks, setLoadingPeaks] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ─── Waveform Setup ───────────────────────────────────────────────
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
                const length = Math.floor(duration * sampleRate);
                const offlineCtx = new OfflineAudioContext(1, length > 0 ? length : 1, sampleRate);
                const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                const channelData = audioBuffer.getChannelData(0);
                const numBars = 60;
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
                const fallback = Array.from({ length: 60 }).map((_, i) => 0.2 + pseudoRandom(seed + i) * 0.6);
                if (!cancelled) { setPeaks(fallback); setLoadingPeaks(false); }
            }
        };
        generatePeaks();
        return () => { cancelled = true; };
    }, [audioUrl, duration]);

    // ─── Audio Core ──────────────────────────────────────────────────
    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.preload = "auto";
        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            const end = start + trimDuration;
            if (audio.currentTime >= end - 0.02) {
                audio.currentTime = start;
                if (!audio.paused) audio.play().catch(() => {});
            }
            if (audio.currentTime < start - 0.1) audio.currentTime = start;
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.pause(); audio.src = ""; audioRef.current = null;
        };
    }, [audioUrl, start, trimDuration]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        if (isPlaying) { audio.pause(); } else {
            if (audio.currentTime < start || audio.currentTime >= start + trimDuration) audio.currentTime = start;
            audio.play().catch(() => {});
        }
    };

    // ─── Drag Logic ──────────────────────────────────────────────────
    const handleDrag = useCallback((type: "start" | "end" | "window", info: any) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = info.point.x;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const timeAtX = (x / rect.width) * duration;

        if (type === "start") {
            const newStart = Math.min(timeAtX, start + trimDuration - 1);
            const newDur = (start + trimDuration) - newStart;
            if (newDur <= maxTrimDuration) {
                setStart(newStart);
                setTrimDuration(newDur);
            }
        } else if (type === "end") {
            const newEnd = Math.max(timeAtX, start + 1);
            const newDur = Math.min(newEnd - start, maxTrimDuration);
            setTrimDuration(newDur);
        } else if (type === "window") {
            // Dragging the whole window keeps duration fixed
            const newStart = Math.max(0, Math.min(timeAtX - (trimDuration / 2), duration - trimDuration));
            setStart(newStart);
        }
    }, [duration, start, trimDuration, maxTrimDuration]);

    const handleDragEnd = () => {
        onTrimChange(start, start + trimDuration);
        if (audioRef.current) audioRef.current.currentTime = start;
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const progress = Math.max(0, Math.min(1, (currentTime - start) / trimDuration));

    return (
        <div className="bg-zinc-950/90 border border-white/10 rounded-2xl p-4 space-y-4 backdrop-blur-2xl shrink-0 shadow-2xl relative overflow-hidden group/trimmer">
            {/* Header */}
            <div className="flex items-center justify-between px-1 relative z-10">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-primary/80">ELITE AUDIO EDITOR</span>
                </div>
                <div className="text-[11px] font-mono text-primary font-black bg-primary/20 px-2 py-1 rounded-lg border border-primary/30">
                    {formatTime(start)} — {formatTime(start + trimDuration)}
                    <span className="text-zinc-600 ml-2">({trimDuration.toFixed(1)}s)</span>
                </div>
            </div>

            {/* Trimmer Container */}
            <div 
                ref={containerRef}
                className="relative h-24 bg-black/40 rounded-xl border border-white/5 overflow-hidden flex items-center"
            >
                {/* Waveform Background (Static) */}
                <div className="absolute inset-x-4 inset-y-6 flex items-end gap-[2px] opacity-20 pointer-events-none">
                    {peaks.map((h, i) => (
                        <div key={i} className="flex-1 rounded-full bg-white" style={{ height: `${20 + h * 80}%` }} />
                    ))}
                </div>

                {/* THE MOVABLE SELECTION BOX */}
                <motion.div
                    className="absolute inset-y-0 z-20 cursor-grab active:cursor-grabbing border-y-2 border-primary/40 bg-primary/5"
                    style={{ 
                        left: `${(start / duration) * 100}%`,
                        width: `${(trimDuration / duration) * 100}%` 
                    }}
                    drag="x"
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={containerRef}
                    onDrag={(_, info) => handleDrag("window", info)}
                    onDragEnd={handleDragEnd}
                >
                    {/* YELLOW PROGRESS METER */}
                    <div 
                        className="absolute inset-y-0 left-0 bg-primary/30 border-r border-primary/50 shadow-[0_0_20px_rgba(255,183,77,0.2)]"
                        style={{ width: `${progress * 100}%` }}
                    />

                    {/* WAVEFORM INSIDE BOX (Bright) */}
                    <div className="absolute inset-x-0 inset-y-6 flex items-end gap-[2px] pointer-events-none">
                        {peaks.map((h, i) => {
                            const pos = (i / peaks.length) * duration;
                            const isActive = pos >= start && pos <= start + trimDuration;
                            return (
                                <div 
                                    key={i} 
                                    className={cn("flex-1 rounded-full transition-opacity", isActive ? "bg-primary opacity-100" : "bg-white opacity-0")} 
                                    style={{ height: `${20 + h * 80}%` }} 
                                />
                            );
                        })}
                    </div>

                    {/* Draggable Handles (Left/Right) */}
                    <motion.div
                        className="absolute inset-y-0 -left-2 w-4 cursor-ew-resize flex items-center justify-center z-30"
                        drag="x"
                        dragMomentum={false}
                        dragElastic={0}
                        onDrag={(_, info) => handleDrag("start", info)}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="w-1.5 h-12 bg-white rounded-full shadow-[0_0_15px_white] ring-4 ring-black/50" />
                    </motion.div>

                    <motion.div
                        className="absolute inset-y-0 -right-2 w-4 cursor-ew-resize flex items-center justify-center z-30"
                        drag="x"
                        dragMomentum={false}
                        dragElastic={0}
                        onDrag={(_, info) => handleDrag("end", info)}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="w-1.5 h-12 bg-primary rounded-full shadow-[0_0_15px_rgba(255,183,77,1)] ring-4 ring-black/50" />
                    </motion.div>

                    {/* Current Time Label inside box */}
                    <div className="absolute top-1 left-2 text-[8px] font-mono text-primary/40 font-bold uppercase tracking-tighter">
                        {formatTime(currentTime)}
                    </div>
                </motion.div>
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
                        className="w-16 h-16 bg-primary/20 border border-primary/40 rounded-2xl flex items-center justify-center hover:bg-primary/30 transition-all active:scale-90 shadow-xl"
                    >
                        <Check className="w-8 h-8 text-primary stroke-[4]" />
                    </button>
                )}
            </div>

            <p className="text-center text-[9px] font-mono text-zinc-600 uppercase tracking-[0.4em] pt-2">
                Drag box to move · Pull edges to resize
            </p>
        </div>
    );
}
