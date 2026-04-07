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
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSeekRef = useRef<number>(0);
    
    // 🔥 CRITICAL: Use refs for the loop logic to avoid re-running useEffect on every drag
    const startRef = useRef(start);
    const endRef = useRef(end);
    
    useEffect(() => {
        startRef.current = start;
        endRef.current = end;
    }, [start, end]);

    // Initialize Audio
    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.preload = "auto";
        audio.loop = false;

        const onLoaded = () => {
            audio.currentTime = startRef.current;
        };

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            // Seamless loop boundary
            if (audio.currentTime >= endRef.current - 0.05) {
                audio.currentTime = startRef.current;
                if (!audio.paused) audio.play().catch(() => {});
            }
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => {
            audio.currentTime = startRef.current;
            audio.play().catch(() => {});
        };

        audio.addEventListener("loadedmetadata", onLoaded);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);

        return () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("ended", onEnded);
            audio.pause();
            audio.src = "";
            audioRef.current = null;
        };
    }, [audioUrl]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
        } else {
            if (audio.currentTime < start || audio.currentTime >= end) {
                audio.currentTime = start;
            }
            audio.play().catch(() => {});
        }
    };

    const handleDrag = (type: "start" | "end", info: any) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = info.point ? info.point.x : info.clientX;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const newTime = (x / rect.width) * duration;

        if (type === "start") {
            // Prevent starting slider from overlapping or creating ghost states
            const nextStart = Math.min(newTime, end - 2);
            if (Math.abs(nextStart - start) > 0.01) {
                setStart(nextStart);
                
                const now = Date.now();
                if (now - lastSeekRef.current > 100) {
                    if (audioRef.current) audioRef.current.currentTime = nextStart;
                    lastSeekRef.current = now;
                }
            }
        } else {
            const nextEnd = Math.max(newTime, start + 2);
            if (Math.abs(nextEnd - end) > 0.01) {
                setEnd(nextEnd);
            }
        }
    };

    const handleDragEnd = () => {
        onTrimChange(start, end);
        if (audioRef.current) {
            audioRef.current.currentTime = start;
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const bars = useRef(Array.from({ length: 48 }).map(() => Math.random()));

    return (
        <div className="bg-zinc-950/60 border border-white/10 rounded-2xl p-4 space-y-4 backdrop-blur-2xl shrink-0 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/80">Trim Audio</span>
                </div>
                <div className="text-[11px] font-mono text-primary font-black bg-primary/20 px-2 py-1 rounded-lg border border-primary/20">
                    {formatTime(start)} — {formatTime(end)}
                </div>
            </div>

            {/* Premium Waveform Trimmer */}
            <div 
                ref={containerRef}
                className="relative h-20 bg-black/60 rounded-2xl overflow-hidden px-4 flex items-center border border-white/5 group/trimmer"
            >
                {/* Visual Waveform */}
                <div className="absolute inset-x-4 inset-y-5 flex items-end gap-[2px] pointer-events-none transition-all duration-300">
                    {bars.current.map((h, i) => {
                        const pos = (i / bars.current.length) * duration;
                        const isActive = pos >= start && pos <= end;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full transition-all duration-500",
                                    isActive ? "bg-primary opacity-100 shadow-[0_0_8px_rgba(255,183,77,0.4)]" : "bg-white/10 opacity-30"
                                )}
                                style={{ height: `${25 + h * 65}%` }}
                            />
                        );
                    })}
                </div>

                {/* PLAYHEAD */}
                <div
                    className="absolute top-0 bottom-0 w-[3px] bg-white z-20 pointer-events-none shadow-[0_0_20px_white] rounded-full"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />

                {/* OVERLAYS (Inactive areas) */}
                <div 
                    className="absolute inset-y-0 left-0 bg-black/80 backdrop-blur-[1px] z-10 border-r border-white/10" 
                    style={{ width: `${(start / duration) * 100}%` }} 
                />
                <div 
                    className="absolute inset-y-0 right-0 bg-black/80 backdrop-blur-[1px] z-10 border-l border-white/10" 
                    style={{ width: `${100 - (end / duration) * 100}%` }} 
                />

                {/* HANDLERS (Physical Knobs) */}
                <motion.div
                    className="absolute inset-y-0 w-8 z-30 cursor-ew-resize flex items-center justify-center -ml-4 active:scale-110 transition-transform"
                    drag="x"
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={containerRef}
                    onDrag={(_, info) => handleDrag("start", info)}
                    onDragEnd={handleDragEnd}
                    style={{ left: `${(start / duration) * 100}%` }}
                >
                    <div className="w-1.5 h-12 bg-white rounded-full shadow-[0_0_25px_white] ring-4 ring-black/50" />
                </motion.div>

                <motion.div
                    className="absolute inset-y-0 w-8 z-30 cursor-ew-resize flex items-center justify-center -mr-4 active:scale-110 transition-transform"
                    drag="x"
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={containerRef}
                    onDrag={(_, info) => handleDrag("end", info)}
                    onDragEnd={handleDragEnd}
                    style={{ left: `${(end / duration) * 100}%` }}
                >
                    <div className="w-1.5 h-12 bg-primary rounded-full shadow-[0_0_25px_rgba(255,183,77,0.8)] ring-4 ring-black/50" />
                </motion.div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-center items-center gap-6">
                <button
                    onClick={togglePlay}
                    className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 group"
                >
                    {isPlaying ? (
                        <Pause className="w-6 h-6 text-primary fill-primary" />
                    ) : (
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                    )}
                </button>
                
                {onConfirm && (
                    <button
                        onClick={onConfirm}
                        className="w-14 h-14 bg-primary/20 border border-primary/40 rounded-2xl flex items-center justify-center hover:bg-primary/30 transition-all active:scale-90 shadow-[0_0_30px_rgba(255,183,77,0.15)] group"
                    >
                        <Check className="w-6 h-6 text-primary" />
                    </button>
                )}
            </div>
        </div>
    );
}
