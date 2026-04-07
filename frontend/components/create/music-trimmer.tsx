"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Scissors, Play, Pause, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; // in seconds
    onTrimChange: (start: number, end: number) => void;
    maxTrimDuration?: number;
    onConfirm?: () => void;
}

/**
 * ─── Instagram-Style Music Trimmer ─────────────────────────────────────
 * Highlights a fixed 30s (or maxTrimDuration) window and lets the user
 * scroll the waveform underneath it.
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration, 
    onTrimChange, 
    maxTrimDuration = 30, 
    onConfirm 
}: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [loadingPeaks, setLoadingPeaks] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastScrollRef = useRef<number>(0);
    
    // Effective selection duration
    const actualSelectionDuration = useMemo(() => Math.min(duration, maxTrimDuration), [duration, maxTrimDuration]);
    const end = useMemo(() => Math.min(start + actualSelectionDuration, duration), [start, actualSelectionDuration, duration]);

    // ─── Waveform Generation (Offline Audio Context) ────────────────
    useEffect(() => {
        let cancelled = false;
        const generatePeaks = async () => {
            if (!audioUrl) return;
            setLoadingPeaks(true);
            try {
                const response = await fetch(audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                
                // Use OfflineAudioContext for faster-than-realtime decoding/processing
                const offlineCtx = new OfflineAudioContext(1, arrayBuffer.byteLength, 44100);
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
                    // Normalize a bit
                    newPeaks.push(Math.pow(max, 0.8)); 
                }
                
                if (!cancelled) {
                    setPeaks(newPeaks);
                    setLoadingPeaks(false);
                }
            } catch (err) {
                console.error("Waveform generation failed:", err);
                const fallback = Array.from({ length: 60 }).map(() => 0.2 + Math.random() * 0.5);
                if (!cancelled) {
                    setPeaks(fallback);
                    setLoadingPeaks(false);
                }
            }
        };

        generatePeaks();
        return () => { cancelled = true; };
    }, [audioUrl]);

    // ─── Audio Logic ────────────────────────────────────────────────
    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.preload = "auto";

        const onTimeUpdate = () => {
            const time = audio.currentTime;
            setCurrentTime(time);
            
            // 🔥 TIGHT CLAMPING: Ensure audio NEVER plays outside [start, end]
            const currentEnd = Math.min(start + actualSelectionDuration, duration);
            
            // If it goes past the end, loop back
            if (time >= currentEnd - 0.02) {
                audio.currentTime = start;
                if (!audio.paused) audio.play().catch(() => {});
            }
            
            // If it somehow drifts before the start, jump back to start
            if (time < start - 0.1) {
                audio.currentTime = start;
            }
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
            audio.pause();
            audio.src = "";
            audioRef.current = null;
        };
    }, [audioUrl, start, actualSelectionDuration, duration]);

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

    // ─── Scroll/Sliding Logic ───────────────────────────────────────
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrollLeft = target.scrollLeft;
        const totalScrollableWidth = target.scrollWidth - target.clientWidth;
        if (totalScrollableWidth <= 0) return;

        const scrollRatio = scrollLeft / totalScrollableWidth;
        const maxOffset = Math.max(0, duration - actualSelectionDuration);
        const newStart = scrollRatio * maxOffset;
        
        setStart(newStart);
        onTrimChange(newStart, newStart + actualSelectionDuration);
        
        // Sync audio current time if it's playing or just moved
        if (audioRef.current && Math.abs(audioRef.current.currentTime - newStart) > 0.5) {
             audioRef.current.currentTime = newStart;
        }
    }, [duration, actualSelectionDuration, onTrimChange]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    // Calculate yellow meter progress (0 to 1) within the 30s selection
    const progress = Math.max(0, Math.min(1, (currentTime - start) / actualSelectionDuration));

    return (
        <div className="bg-zinc-950/60 border border-white/10 rounded-2xl p-4 space-y-4 backdrop-blur-2xl shrink-0 shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-1 relative z-10">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/80">Elite Trimmer</span>
                </div>
                <div className="text-[11px] font-mono text-primary font-black bg-primary/20 px-2 py-1 rounded-lg border border-primary/20">
                    {formatTime(start)} — {formatTime(end)}
                </div>
            </div>

            {/* Waveform Area */}
            <div className="relative h-28 flex items-center bg-black/40 rounded-2xl border border-white/5 overflow-hidden group">
                
                {/* 
                    Fixed Selection Box (Center Window)
                    We use a fixed size for the window (approx 40% of container width)
                    and the user scrolls the waveform behind it.
                */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <div 
                        className={cn(
                            "relative h-[85%] border-2 border-white rounded-xl shadow-[0_0_40px_rgba(255,255,255,0.1)] bg-white/5 backdrop-blur-[1px] transition-all duration-500",
                            duration > actualSelectionDuration ? "w-[45%]" : "w-[95%]"
                        )}
                    >
                        {/* THE YELLOW METER - Fills up within the selection box */}
                        <motion.div 
                            className="absolute inset-y-0 left-0 bg-primary/80 shadow-[0_0_20px_rgba(255,183,77,0.4)] rounded-lg"
                            animate={{ width: `${progress * 100}%` }}
                            transition={{ duration: 0.1, ease: "linear" }}
                        />
                        
                        {/* Decorative Handlers */}
                        <div className="absolute inset-y-0 -left-1.5 w-3 flex flex-col justify-center gap-1">
                             <div className="w-full h-8 bg-white rounded-full shadow-lg" />
                        </div>
                        <div className="absolute inset-y-0 -right-1.5 w-3 flex flex-col justify-center gap-1">
                             <div className="w-full h-8 bg-white rounded-full shadow-lg" />
                        </div>
                    </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div 
                    onScroll={handleScroll}
                    className="absolute inset-0 overflow-x-auto no-scrollbar scroll-smooth flex items-center h-full px-[27.5%] md:px-[27.5%]"
                >
                    {/* The Waveform itself */}
                    <div className="flex items-center gap-[2px] h-full" style={{ minWidth: duration > actualSelectionDuration ? "100%" : "auto" }}>
                        {loadingPeaks ? (
                            <div className="flex items-center gap-2 px-8">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Generating...</span>
                            </div>
                        ) : (
                            peaks.map((h, i) => (
                                <div
                                    key={i}
                                    className="w-[3px] rounded-full transition-all duration-700 bg-white/20"
                                    style={{ 
                                        height: `${20 + h * 60}%`,
                                        opacity: 0.3 + (h * 0.7)
                                    }}
                                />
                            ))
                        )}
                    </div>
                    
                    {/* Invisible spacer to allow scrolling till the end */}
                    <div className="flex-shrink-0 w-[100%] h-1" />
                </div>

                {/* Dark Gradient Overlays for edges */}
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/60 to-transparent pointer-events-none z-20" />
                <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/60 to-transparent pointer-events-none z-20" />
            </div>

            {/* Play/Confirm Controls */}
            <div className="flex justify-center items-center gap-6 pb-2">
                <button
                    onClick={togglePlay}
                    className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 group"
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
                        className="w-14 h-14 bg-primary/20 border border-primary/40 rounded-2xl flex items-center justify-center hover:bg-primary/30 transition-all active:scale-90 shadow-xl group"
                    >
                        <Check className="w-6 h-6 text-primary" />
                    </button>
                )}
            </div>
            
            <div className="flex flex-col items-center gap-1 opacity-40">
                <p className="text-[8px] font-mono uppercase tracking-[0.3em]">Scroll Waveform to select part</p>
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" />
            </div>
        </div>
    );
}
