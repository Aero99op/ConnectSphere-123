"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Scissors, Play, Pause, Check } from "lucide-react";
import { motion } from "framer-motion";
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
        audio.loop = false; // We handle loop via timeupdate

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

    // ⚡ PRO OPTIMIZATION: Throttle seeking and defer parent updates
    const handleDrag = (type: "start" | "end", info: any) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = info.point ? info.point.x : info.clientX;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const newTime = (x / rect.width) * duration;

        if (type === "start") {
            const nextStart = Math.min(newTime, end - 2);
            setStart(nextStart);
            
            // 🛡️ THROTTLE: Only seek audio every 100ms during drag
            const now = Date.now();
            if (now - lastSeekRef.current > 100) {
                if (audioRef.current) audioRef.current.currentTime = nextStart;
                lastSeekRef.current = now;
            }
        } else {
            const nextEnd = Math.max(newTime, start + 2);
            setEnd(nextEnd);
        }
    };

    // 🛡️ SYNC FINAL STATE: Push to parent only when dragging stops
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

    // Static bar patterns
    const bars = useRef(Array.from({ length: 40 }).map(() => Math.random()));

    return (
        <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 space-y-4 backdrop-blur-xl shrink-0">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Scissors className="w-3.5 h-3.5 text-primary opacity-80" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Trim Track</span>
                </div>
                <div className="text-[10px] font-mono text-primary font-black bg-primary/10 px-2 py-0.5 rounded-md">
                    {formatTime(start)} - {formatTime(end)}
                </div>
            </div>

            {/* Waveform Trimmer */}
            <div 
                ref={containerRef}
                className="relative h-20 bg-black/40 rounded-xl overflow-hidden px-4 flex items-center border border-white/5"
            >
                {/* Waveform Bars */}
                <div className="absolute inset-x-4 inset-y-6 flex items-end gap-[3px] pointer-events-none opacity-30">
                    {bars.current.map((h, i) => {
                        const pos = (i / bars.current.length) * duration;
                        const isActive = pos >= start && pos <= end;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full",
                                    isActive ? "bg-primary" : "bg-zinc-800"
                                )}
                                style={{ height: `${20 + h * 70}%` }}
                            />
                        );
                    })}
                </div>

                {/* PLAYHEAD */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none shadow-[0_0_15px_white]"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />

                {/* INACTIVE AREAS */}
                <div className="absolute inset-y-0 left-0 bg-black/70 z-10" style={{ width: `${(start / duration) * 100}%` }} />
                <div className="absolute inset-y-0 right-0 bg-black/70 z-10" style={{ width: `${100 - (end / duration) * 100}%` }} />

                {/* HANDLERS */}
                <motion.div
                    className="absolute inset-y-0 w-5 z-30 cursor-ew-resize flex items-center justify-center -ml-2.5"
                    drag="x"
                    dragMomentum={false}
                    dragConstraints={containerRef}
                    onDrag={(_, info) => handleDrag("start", info)}
                    onDragEnd={handleDragEnd}
                    style={{ left: `${(start / duration) * 100}%` }}
                >
                    <div className="w-2 h-full bg-white rounded-full shadow-[0_0_20px_white]" />
                </motion.div>

                <motion.div
                    className="absolute inset-y-0 w-5 z-30 cursor-ew-resize flex items-center justify-center -mr-2.5"
                    drag="x"
                    dragMomentum={false}
                    dragConstraints={containerRef}
                    onDrag={(_, info) => handleDrag("end", info)}
                    onDragEnd={handleDragEnd}
                    style={{ left: `${(end / duration) * 100}%` }}
                >
                    <div className="w-2 h-full bg-primary rounded-full shadow-[0_0_20px_rgba(255,183,77,0.6)]" />
                </motion.div>
            </div>

            {/* Quick Controls */}
            <div className="flex justify-center items-center gap-4">
                <button
                    onClick={togglePlay}
                    className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
                >
                    {isPlaying ? <Pause className="w-5 h-5 text-primary fill-primary" /> : <Play className="w-5 h-5 text-white fill-white ml-1" />}
                </button>
                
                {onConfirm && (
                    <button
                        onClick={onConfirm}
                        className="w-12 h-12 bg-primary/20 border border-primary/40 rounded-full flex items-center justify-center hover:bg-primary/30 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,183,77,0.2)]"
                    >
                        <Check className="w-5 h-5 text-primary" />
                    </button>
                )}
            </div>
        </div>
    );
}
