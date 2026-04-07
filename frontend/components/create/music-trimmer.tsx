"use client";

import { useState, useRef, useEffect } from "react";
import { Scissors, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; // in seconds
    onTrimChange: (start: number, end: number) => void;
    maxTrimDuration?: number;
}

export function MusicTrimmer({ audioUrl, duration, onTrimChange, maxTrimDuration = 30 }: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(Math.min(duration, maxTrimDuration));
    const [isPlaying, setIsPlaying] = useState(true); // Default to playing for Instagram feel
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
        } else if (audioRef.current.src !== audioUrl) {
            audioRef.current.src = audioUrl;
        }

        const audio = audioRef.current;
        
        // Auto-play on mount/url change
        if (isPlaying) {
            audio.currentTime = start;
            audio.play().catch(() => setIsPlaying(false));
        }

        const updateProgress = () => {
            if (!audio) return;
            setCurrentTime(audio.currentTime);
            
            // Precise Instagram-style loop boundary
            if (audio.currentTime >= end - 0.1) {
                audio.currentTime = start;
                if (!audio.paused) {
                    audio.play().catch(() => {});
                }
            }
        };

        audio.addEventListener("timeupdate", updateProgress);
        
        // Reset to start on mount or URL change
        audio.currentTime = start;

        return () => {
            audio.removeEventListener("timeupdate", updateProgress);
            audio.pause();
        };
    }, [audioUrl, start, end]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
        } else {
            // Restart from start point if finished or outside range
            if (audio.currentTime >= end || audio.currentTime < start) {
                audio.currentTime = start;
            }
            audio.play().catch(() => {});
        }
        setIsPlaying(!isPlaying);
    };

    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>, type: "start" | "end") => {
        const val = parseFloat(e.target.value);
        let nS = start;
        let nE = end;

        if (type === "start") {
            nS = Math.min(val, end - 2); // Maintain min 2s clip
            setStart(nS);
        } else {
            nE = Math.max(val, start + 2);
            setEnd(nE);
        }

        onTrimChange(nS, nE);

        // Instagram native feel: Jump to new start and play immediately while adjusting
        if (audioRef.current) {
            audioRef.current.currentTime = nS;
            if (audioRef.current.paused) {
                audioRef.current.play().catch(() => {});
                setIsPlaying(true);
            }
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="bg-zinc-950/40 border border-white/10 rounded-2xl p-5 space-y-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
                        <Scissors className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white italic">Trim Best Part</h3>
                </div>
                <div className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full shadow-[0_0_15px_rgba(255,183,77,0.1)]">
                    {formatTime(start)} - {formatTime(end)} ({Math.round(end - start)}s)
                </div>
            </div>

            {/* Visual Waveform */}
            <div className="relative h-20 bg-black/40 rounded-xl overflow-hidden flex items-end gap-[3px] px-3 border border-white/5 group/wave">
                {Array.from({ length: 50 }).map((_, i) => {
                    const pos = (i / 50) * duration;
                    const isActive = pos >= start && pos <= end;
                    return (
                        <div
                            key={i}
                            className={cn(
                                "flex-1 rounded-full transition-all duration-500",
                                isActive 
                                    ? "bg-primary shadow-[0_0_10px_rgba(255,183,77,0.4)] h-[50%]" 
                                    : "bg-zinc-800 h-[25%]"
                            )}
                            style={{ 
                                height: isActive ? `${40 + Math.random() * 50}%` : `${15 + Math.random() * 20}%`,
                                opacity: isActive ? 1 : 0.3
                            }}
                        />
                    );
                })}

                {/* Playhead Indicator */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-10 transition-all duration-75 shadow-[0_0_15px_white]"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />
                
                {/* Active Range Overlay */}
                <div 
                    className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none border-x border-primary/20"
                    style={{ left: `${(start / duration) * 100}%`, right: `${100 - (end / duration) * 100}%` }}
                />
            </div>

            {/* Range Controls */}
            <div className="space-y-6 pt-2">
                <div className="relative h-2 flex items-center mx-1">
                    <div className="absolute inset-0 h-1.5 bg-zinc-800 rounded-full" />
                    <div
                        className="absolute h-1.5 bg-primary shadow-[0_0_15px_rgba(255,183,77,0.3)]"
                        style={{ left: `${(start / duration) * 100}%`, right: `${100 - (end / duration) * 100}%` }}
                    />
                    
                    <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={start}
                        onChange={(e) => handleRangeChange(e, "start")}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-zinc-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-xl [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:active:scale-125 transition-transform"
                    />
                    <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={end}
                        onChange={(e) => handleRangeChange(e, "end")}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-zinc-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-xl [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:active:scale-125 transition-transform"
                    />
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={togglePlay}
                        className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 hover:border-primary/50 transition-all active:scale-90 group/play"
                    >
                        {isPlaying ? (
                            <Pause className="w-6 h-6 text-white text-primary fill-current drop-shadow-[0_0_10px_rgba(255,183,77,0.5)]" />
                        ) : (
                            <Play className="w-6 h-6 text-white fill-current ml-1 group-hover/play:text-primary transition-colors" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
