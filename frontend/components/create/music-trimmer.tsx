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
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
        } else {
            audioRef.current.src = audioUrl;
        }

        const audio = audioRef.current;

        const updateProgress = () => {
            setCurrentTime(audio.currentTime);
            if (audio.currentTime >= end) {
                audio.currentTime = start;
                if (!audio.paused) {
                    // Loop within trim range
                }
            }
        };

        audio.addEventListener("timeupdate", updateProgress);
        return () => {
            audio.removeEventListener("timeupdate", updateProgress);
            audio.pause();
        };
    }, [audioUrl, start, end]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.currentTime = start;
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>, type: "start" | "end") => {
        const val = parseFloat(e.target.value);
        if (type === "start") {
            const newStart = Math.min(val, end - 1);
            setStart(newStart);
            if (audioRef.current) audioRef.current.currentTime = newStart;
            onTrimChange(newStart, end);
        } else {
            const newEnd = Math.max(val, start + 1);
            setEnd(newEnd);
            onTrimChange(start, newEnd);
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Trim Best Part</h3>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded-md">
                    {formatTime(start)} - {formatTime(end)} ({Math.round(end - start)}s)
                </div>
            </div>

            {/* Visual Waveform Placeholder */}
            <div className="relative h-16 bg-zinc-800 rounded-xl overflow-hidden flex items-end gap-[2px] px-2 border border-white/5">
                {Array.from({ length: 40 }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex-1 bg-primary/20 rounded-full transition-all",
                            (i / 40) * duration >= start && (i / 40) * duration <= end ? "bg-primary h-[40%]" : "h-[20%]"
                        )}
                        style={{ height: `${20 + Math.random() * 60}%` }}
                    />
                ))}

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_white] z-10 transition-all duration-100"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />
            </div>

            {/* Range Sliders */}
            <div className="space-y-4">
                <div className="relative h-6 flex items-center">
                    <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={start}
                        onChange={(e) => handleRangeChange(e, "start")}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={end}
                        onChange={(e) => handleRangeChange(e, "end")}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <div className="absolute inset-0 h-1 bg-zinc-800 rounded-full" />
                    <div
                        className="absolute h-1 bg-primary/50"
                        style={{ left: `${(start / duration) * 100}%`, right: `${100 - (end / duration) * 100}%` }}
                    />
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={togglePlay}
                        className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-90 border border-white/10"
                    >
                        {isPlaying ? <Pause className="w-6 h-6 text-white fill-current" /> : <Play className="w-6 h-6 text-white fill-current ml-1" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
