"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Check, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number;
    onTrimChange: (start: number, end: number) => void;
    onConfirm?: () => void;
}

export function MusicTrimmer({
    audioUrl,
    duration = 30,
    onTrimChange,
    onConfirm
}: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(Math.min(15, duration));
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isDecoding, setIsDecoding] = useState(true);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const startRef = useRef(0);
    const endRef = useRef(Math.min(15, duration));
    const raftRef = useRef<number | null>(null);
    const isInteractingRef = useRef(false);

    useEffect(() => {
        startRef.current = start;
        endRef.current = end;
    }, [start, end]);

    // ─── Phase 1: Native Fast Audio Decoder ──────────────────────────────
    useEffect(() => {
        let active = true;
        setIsDecoding(true);

        // Fallback visual seed while loading
        const seed = Array.from({ length: 60 }).map(() => 0.1 + Math.random() * 0.2);
        setPeaks(seed);

        const decode = async () => {
            if (!audioUrl) return;
            try {
                // iTunes supports CORS natively, allowing instant byte extraction 
                const res = await fetch(audioUrl, { headers: { 'Range': 'bytes=0-2000000' } });
                if (!res.ok) throw new Error("Fetch failed");
                const blob = await res.arrayBuffer();
                const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
                const buffer = await offline.decodeAudioData(blob);

                if (active) {
                    const data = buffer.getChannelData(0);
                    const bars = 60; // 60 bars for clean Instagram look
                    const step = Math.floor(data.length / bars);
                    const p: number[] = [];
                    for (let i = 0; i < bars; i++) {
                        let m = 0;
                        for (let j = 0; j < step; j += 40) {
                            const v = Math.abs(data[i * step + j] || 0);
                            if (v > m) m = v;
                        }
                        p.push(Math.pow(m * 2.0, 0.5)); // Soften peaks
                    }
                    setPeaks(p);
                }
            } catch (e) {
                console.warn("Waveform decode failed, using cosmetic UI.", e);
            } finally {
                if (active) setIsDecoding(false);
            }
        };
        decode();
        return () => { active = false; };
    }, [audioUrl]);

    // ─── Phase 2: Playback Engine ──────────────────────────────
    const stopPlayback = useCallback(() => {
        if (!audioRef.current) return;
        setIsPlaying(false);
        if (raftRef.current) cancelAnimationFrame(raftRef.current);

        setTimeout(() => {
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
            }
        }, 50);
    }, []);

    const startPlayback = useCallback(() => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        const sTime = startRef.current;
        const eTime = endRef.current;

        if (audio.error) audio.load();

        audio.currentTime = sTime;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.warn("Playback failed", e);
                setIsPlaying(false);
            });
        }
        setIsPlaying(true);

        const syncLoop = () => {
            if (isInteractingRef.current) return;
            const now = audio.currentTime;
            setCurrentTime(now);
            if (now >= eTime || now < sTime - 0.1) {
                audio.currentTime = sTime;
            }
            raftRef.current = requestAnimationFrame(syncLoop);
        };
        raftRef.current = requestAnimationFrame(syncLoop);
    }, []);

    // ─── Phase 3: Instagram Free-Drag Engine ──────────────────────────────
    const handleDrag = (type: "start" | "end" | "playhead", e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.button !== 0 && type !== 'playhead') return; // Only process left clicks
        
        isInteractingRef.current = true;
        stopPlayback();

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const onMove = (mv: PointerEvent) => {
            // Include margin bounds (approx 1rem buffer from edges for handle thickness)
            const paddingPx = 8;
            const usableWidth = rect.width - (paddingPx * 2);
            let percentX = (mv.clientX - (rect.left + paddingPx)) / usableWidth;
            percentX = Math.max(0, Math.min(1, percentX));
            
            const timeAtPointer = percentX * duration;

            let ns = startRef.current;
            let ne = endRef.current;
            const minGap = 1;

            if (type === "start") {
                ns = Math.max(0, Math.min(timeAtPointer, ne - minGap));
                setCurrentTime(ns);
            } else if (type === "end") {
                ne = Math.max(ns + minGap, Math.min(timeAtPointer, duration));
                setCurrentTime(ns);
            } else if (type === "playhead") {
                const tc = Math.max(ns, Math.min(timeAtPointer, ne));
                setCurrentTime(tc);
                if (audioRef.current) audioRef.current.currentTime = tc;
            }

            setStart(ns);
            setEnd(ne);
        };

        const onUp = () => {
            isInteractingRef.current = false;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            onTrimChange(startRef.current, endRef.current);
            startPlayback();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const formatTime = (s: number) => {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sc = Math.floor(s % 60);
        return `${m}:${sc.toString().padStart(2, "0")}`;
    };

    const startPercent = (start / duration) * 100;
    const endPercent = (end / duration) * 100;

    // Render exact Instagram-style waveform
    const renderWaveform = (activeMask = false) => (
        <div className="flex items-center justify-between h-full px-2">
            {peaks.map((h, i) => (
                <div
                    key={i}
                    className={cn("w-1 rounded-full transition-all duration-300", activeMask ? "bg-white" : "bg-white/20")}
                    style={{ height: `${Math.max(10, Math.min(100, h * 100))}%` }}
                />
            ))}
        </div>
    );

    return (
        <div className="pt-2 space-y-6">
            <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />

            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px] uppercase tracking-widest font-black">
                    <Clock className="w-3.5 h-3.5" /> {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                    {(end - start).toFixed(1)}s Trim
                </div>
            </div>

            {/* INSTAGRAM-STYLE TRIMMER UI */}
            <div
                ref={containerRef}
                className="relative h-20 bg-black/40 rounded-2xl overflow-hidden border border-white/5 py-1"
            >
                {/* 1. Base Inactive Waveform */}
                <div className="absolute inset-0 pointer-events-none">
                    {renderWaveform(false)}
                </div>

                {/* 2. Highlighted Clip Window */}
                <div
                    className="absolute inset-y-0 pointer-events-none z-10 border-y-2 border-white/80 bg-white/5 backdrop-contrast-125"
                    style={{ left: `calc(${startPercent}%)`, width: `calc(${endPercent - startPercent}%)` }}
                >
                    {/* Reverse clip mask to precisely render active white bars aligned perfectly with background bars */}
                    <div className="absolute inset-y-0 overflow-hidden" style={{ width: '100%', left: 0 }}>
                        <div className="absolute inset-y-0 pointer-events-none" style={{ width: `${containerRef.current?.clientWidth || 500}px`, left: `-${startPercent}%`, transform: `translateX(calc(-${startPercent}vw))`}}>
                             {/* Advanced UI matching: Instagram simply highlights the area. CSS makes it tricky to precisely reverse-align, so we use backdrop-brightness for an identical look in 1 line. */}
                        </div>
                    </div>
                    {/* Simple reliable Instagram highlighting */}
                    <div className="absolute inset-0 backdrop-brightness-150 backdrop-contrast-125 mix-blend-screen" />
                </div>

                {/* 3. Drag Handles & Thumb */}
                {/* Start Handle */}
                <div
                    className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize pointer-events-auto z-40 group touch-none"
                    style={{ left: `${startPercent}%` }}
                    onPointerDown={(e) => handleDrag("start", e)}
                >
                    <div className="w-2.5 h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)] group-active:scale-x-125 transition-transform" />
                </div>

                {/* End Handle */}
                <div
                    className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize pointer-events-auto z-40 group touch-none"
                    style={{ left: `${endPercent}%` }}
                    onPointerDown={(e) => handleDrag("end", e)}
                >
                    <div className="w-2.5 h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)] group-active:scale-x-125 transition-transform" />
                </div>

                {/* Vertical Playhead Tracker */}
                <div
                    className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize pointer-events-auto z-50 touch-none"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                    onPointerDown={(e) => handleDrag("playhead", e)}
                >
                    <div className="w-1.5 h-[110%] bg-white rounded-full shadow-[0_0_20px_white] drop-shadow-lg" />
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between">
                <button
                    onClick={isPlaying ? stopPlayback : startPlayback}
                    className="w-12 h-12 bg-white/5 border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
                >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                </button>

                {onConfirm && (
                    <button
                        onClick={onConfirm}
                        className="h-12 bg-white text-black px-8 rounded-full flex items-center justify-center gap-2 font-black uppercase tracking-wider text-xs hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        <Check className="w-4 h-4 stroke-[4]" /> Cut
                    </button>
                )}
            </div>
        </div>
    );
}
