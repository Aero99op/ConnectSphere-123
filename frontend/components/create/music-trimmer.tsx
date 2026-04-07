"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Scissors, Play, Pause, Check } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; // in seconds
    onTrimChange: (start: number, end: number) => void;
    maxTrimDuration?: number;
    onConfirm?: () => void;
}

export function MusicTrimmer({ 
    audioUrl, 
    duration, 
    onTrimChange, 
    maxTrimDuration = 30, 
    onConfirm 
}: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(Math.min(duration, maxTrimDuration));
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync audio to state changes
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
        } else if (audioRef.current.src !== audioUrl) {
            audioRef.current.src = audioUrl;
            setStart(0);
            setEnd(Math.min(duration, maxTrimDuration));
        }

        const audio = audioRef.current;
        
        // Handle metadata loaded
        const onLoaded = () => {
            audio.currentTime = start;
            if (isPlaying) audio.play().catch(() => setIsPlaying(false));
        };
        
        audio.addEventListener("loadedmetadata", onLoaded);
        
        // Loop Logic
        const updateProgress = () => {
            setCurrentTime(audio.currentTime);
            if (audio.currentTime >= end - 0.1) {
                audio.currentTime = start;
                audio.play().catch(() => {});
            }
        };

        audio.addEventListener("timeupdate", updateProgress);

        return () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("timeupdate", updateProgress);
            audio.pause();
        };
    }, [audioUrl, start, end, duration, maxTrimDuration]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            if (audioRef.current.currentTime >= end || audioRef.current.currentTime < start) {
                audioRef.current.currentTime = start;
            }
            audioRef.current.play().catch(() => {});
        }
        setIsPlaying(!isPlaying);
    };

    const handleDrag = (type: "start" | "end", info: any) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = info.point ? info.point.x : info.clientX;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const newTime = (x / rect.width) * duration;

        if (type === "start") {
            const nextStart = Math.min(newTime, end - 2);
            setStart(nextStart);
            if (audioRef.current) audioRef.current.currentTime = nextStart;
            onTrimChange(nextStart, end);
        } else {
            const nextEnd = Math.max(newTime, start + 2);
            setEnd(nextEnd);
            onTrimChange(start, nextEnd);
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    // Waveform heights randomizer
    const bars = useRef(Array.from({ length: 40 }).map(() => Math.random()));

    return (
        <div className="bg-zinc-950/60 border border-white/10 rounded-2xl p-4 space-y-4 backdrop-blur-xl shadow-2xl">
            {/* Header info */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center animate-pulse border border-primary/20">
                        <Scissors className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80 italic">Precision Cut</h3>
                </div>
                <div className="text-[10px] font-mono font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                    {formatTime(start)} - {formatTime(end)} ({Math.round(end - start)}s)
                </div>
            </div>

            {/* Premium Trimmer Waveform */}
            <div 
                ref={containerRef}
                className="relative h-28 bg-black/60 rounded-xl overflow-hidden px-4 flex items-center group/wave border border-white/5"
            >
                {/* Background Waveform Bars */}
                <div className="absolute inset-x-4 inset-y-6 flex items-end gap-[4px] pointer-events-none">
                    {bars.current.map((h, i) => {
                        const pos = (i / bars.current.length) * duration;
                        const isActive = pos >= start && pos <= end;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full transition-all duration-300",
                                    isActive ? "bg-primary shadow-[0_0_8px_rgba(255,183,77,0.4)]" : "bg-zinc-800"
                                )}
                                style={{ 
                                    height: isActive ? `${40 + h * 55}%` : `${15 + h * 25}%`,
                                    opacity: isActive ? 0.9 : 0.2
                                }}
                            />
                        );
                    })}
                </div>

                {/* PLAYHEAD */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none shadow-[0_0_15px_white]"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />

                {/* INACTIVE AREA OVERLAYS (Black Out) */}
                <div className="absolute inset-y-0 left-0 bg-black/60 z-10" style={{ width: `${(start / duration) * 100}%` }} />
                <div className="absolute inset-y-0 right-0 bg-black/60 z-10" style={{ width: `${100 - (end / duration) * 100}%` }} />

                {/* ACTIVE RANGE OUTLINE */}
                <div 
                    className="absolute inset-y-0 bg-primary/5 border-y-2 border-primary/40 z-10"
                    style={{ left: `${(start / duration) * 100}%`, right: `${100 - (end / duration) * 100}%` }}
                />

                {/* CUSTOM TALL HANDLERS (Framer Motion) */}
                <motion.div
                    className="absolute inset-y-0 w-2.5 z-30 cursor-ew-resize flex items-center justify-center -ml-1"
                    drag="x"
                    dragMomentum={false}
                    dragConstraints={containerRef}
                    onDrag={(_, info) => handleDrag("start", info)}
                    style={{ left: `${(start / duration) * 100}%` }}
                >
                    <div className="w-1.5 h-full bg-white rounded-full shadow-[0_0_20px_white] ring-4 ring-black/50" />
                </motion.div>

                <motion.div
                    className="absolute inset-y-0 w-2.5 z-30 cursor-ew-resize flex items-center justify-center -mr-1"
                    drag="x"
                    dragMomentum={false}
                    dragConstraints={containerRef}
                    onDrag={(_, info) => handleDrag("end", info)}
                    style={{ left: `${(end / duration) * 100}%` }}
                >
                    <div className="w-1.5 h-full bg-primary rounded-full shadow-[0_0_20px_rgba(255,183,77,0.6)] ring-4 ring-black/50" />
                </motion.div>
            </div>

            {/* Main Controls */}
            <div className="flex justify-center items-center gap-6 pb-2">
                <button
                    onClick={togglePlay}
                    className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 hover:border-primary transition-all active:scale-95 group/play"
                >
                    {isPlaying ? (
                        <Pause className="w-6 h-6 text-primary fill-primary drop-shadow-[0_0_12px_rgba(255,183,77,0.5)]" />
                    ) : (
                        <Play className="w-6 h-6 text-white fill-current ml-1" />
                    )}
                </button>
                
                {onConfirm && (
                    <button
                        onClick={onConfirm}
                        className="w-14 h-14 bg-primary/20 border border-primary/40 rounded-full flex items-center justify-center hover:bg-primary/30 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,183,77,0.2)]"
                    >
                        <Check className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(255,183,77,0.5)]" />
                    </button>
                )}
            </div>
        </div>
    );
}
