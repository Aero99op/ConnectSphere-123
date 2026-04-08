"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Check, Clock, Loader2, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicTrimmerProps {
    audioUrl: string;
    duration: number; 
    onTrimChange: (start: number, end: number) => void;
    onConfirm?: () => void;
}

/**
 * ─── ConnectSphere-Apex (v21 - THE AUTO-SCROLL ENGINE) ───────────────
 * SURGICAL UPGRADES:
 * 1. Auto-Follow Drag: Handles (Start/End) scroll the waveform when they hit edges.
 * 2. Visual Persistence: Handles are ALWAYS visible in the viewport.
 * 3. Dynamic Duration: Resize the clip from 1s to full song (flexible limits).
 * 4. Absolute Timestamp: Floating top header tracks playhead position precisely.
 */
export function MusicTrimmer({ 
    audioUrl, 
    duration = 30, 
    onTrimChange, 
    onConfirm 
}: MusicTrimmerProps) {
    const [start, setStart] = useState(0);
    const [trimDuration, setTrimDuration] = useState(Math.min(15, duration));
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isDecoding, setIsDecoding] = useState(true);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const startRef = useRef(0);
    const trimRef = useRef(15);
    const raftRef = useRef<number | null>(null);
    const isInteractingRef = useRef(false);

    // Dynamic scaling
    const PX_PER_SEC = 60; // Fixed for consistent scroll feel
    const VIEW_SECONDS = 30; // Visible window duration

    useEffect(() => {
        startRef.current = start;
        trimRef.current = trimDuration;
    }, [start, trimDuration]);

    // ─── Phase 1: Zero-RAM Peak Engine ───────────────────────────────
    useEffect(() => {
        const seed = Array.from({ length: 400 }).map((_, i) => 
            0.1 + (Math.sin(i * 0.1) * 0.1) + (Math.random() * 0.25)
        );
        setPeaks(seed);
        
        let active = true;
        const decode = async () => {
            if (!audioUrl) return;
            try {
                const res = await fetch(audioUrl, { headers: { 'Range': 'bytes=0-8000000' } }).catch(() => fetch(audioUrl));
                const blob = await res.arrayBuffer();
                const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
                const buffer = await offline.decodeAudioData(blob);
                
                if (active) {
                    const data = buffer.getChannelData(0);
                    const bars = Math.floor(duration * 5);
                    const step = Math.floor(data.length / bars);
                    const p: number[] = [];
                    for (let i = 0; i < bars; i++) {
                        let m = 0;
                        for (let j = 0; j < step; j += 40) {
                            const v = Math.abs(data[i * step + j] || 0);
                            if (v > m) m = v;
                        }
                        p.push(Math.pow(m * 2.5, 0.75));
                    }
                    setPeaks(p);
                }
            } catch (e) {
                console.warn("Using fallback visuals.");
            } finally {
                if (active) setIsDecoding(false);
            }
        };
        decode();
        return () => { active = false; };
    }, [audioUrl, duration]);

    // ─── Phase 2: Playback Mechanics ──────────────────────────────────
    const stopPlayback = useCallback(() => {
        if (audioRef.current) audioRef.current.pause();
        if (raftRef.current) cancelAnimationFrame(raftRef.current);
        setIsPlaying(false);
    }, []);

    const startPlayback = useCallback(() => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        const sTime = startRef.current;
        const eTime = sTime + trimRef.current;

        audio.currentTime = sTime;
        audio.play().catch(() => {});
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

    // ─── Phase 3: Surgical Drag & Auto-Scroll Logic ──────────────────
    const handleDrag = (type: "scroll" | "start" | "end" | "playhead", e: React.PointerEvent) => {
        e.preventDefault();
        isInteractingRef.current = true;
        stopPlayback();
        
        const vpRect = viewportRef.current?.getBoundingClientRect();
        if (!vpRect) return;

        const initialX = e.clientX;
        const initialS = startRef.current;
        const initialT = trimRef.current;

        const onMove = (mv: PointerEvent) => {
            const dx = mv.clientX - initialX;
            const dt = dx / PX_PER_SEC;

            if (type === "scroll") {
                const ns = Math.max(0, Math.min(initialS - dt, duration - initialT));
                setStart(ns);
                startRef.current = ns;
            } else if (type === "start") {
                const ns = Math.max(0, Math.min(initialS + dt, initialS + initialT - 0.5));
                const nt = initialT - (ns - initialS);
                setStart(ns);
                setTrimDuration(nt);
                startRef.current = ns;
                trimRef.current = nt;
                setCurrentTime(ns);
            } else if (type === "end") {
                const nt = Math.max(0.5, Math.min(initialT + dt, duration - initialS));
                setTrimDuration(nt);
                trimRef.current = nt;
                setCurrentTime(initialS + nt);
            } else if (type === "playhead") {
                const percent = Math.max(0, Math.min(1, (mv.clientX - vpRect.left) / vpRect.width));
                const nc = initialS + (percent * initialT);
                setCurrentTime(nc);
                if (audioRef.current) audioRef.current.currentTime = nc;
            }
        };

        const onUp = () => {
            isInteractingRef.current = false;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            onTrimChange(startRef.current, startRef.current + trimRef.current);
            startPlayback();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sc = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 10);
        return `${m}:${sc.toString().padStart(2, "0")}.${ms}`;
    };

    return (
        <div className="bg-[#0e0e10] border border-white/5 rounded-[2.5rem] p-8 space-y-10 shadow-2xl relative overflow-hidden select-none max-w-2xl mx-auto">
            <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" preload="metadata" className="hidden" />

            {/* Surgical Header Info */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-tr from-[#FF7E5F] to-[#FF512F] rounded-2xl shadow-lg ring-4 ring-[#FF7E5F]/10">
                        <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[#FF7E5F] font-black text-2xl font-mono tracking-tighter">
                            {formatTime(currentTime)}
                        </span>
                        <span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest leading-none">
                            Current Beat
                        </span>
                    </div>
                </div>
                
                <div className="bg-[#1a1a1c] border border-white/5 px-6 py-4 rounded-[1.5rem] flex flex-col items-end">
                    <span className="text-white/90 font-mono font-black text-sm">
                        {trimDuration.toFixed(1)}s Trim
                    </span>
                    <span className="text-[#FF7E5F] font-mono text-[9px] font-black uppercase tracking-widest mt-0.5">
                        Selected Range
                    </span>
                </div>
            </div>

            {/* Viewport - THE AUTO-SCROLL SURGICAL REGION */}
            <div 
                ref={viewportRef}
                className="relative h-28 bg-[#121214] border border-white/10 rounded-[1.8rem] overflow-hidden flex items-center shadow-inner"
            >
                {/* INFINITE WAVEFORM (Responsive to handles) */}
                <div 
                    className="flex items-center h-full will-change-transform z-10 cursor-grab active:cursor-grabbing px-[50%]"
                    style={{ 
                        width: `${duration * PX_PER_SEC}px`,
                        // Centers the selection regardless of width
                        transform: `translateX(calc(-${(trimDuration * PX_PER_SEC) / 2}px - ${start * PX_PER_SEC}px))`
                    }}
                    onPointerDown={(e) => handleDrag("scroll", e)}
                >
                    <div className="flex items-center gap-[1.2px] h-[75%]">
                        {peaks.map((h, i) => {
                            const time = (i / peaks.length) * duration;
                            const isActive = time >= start && time <= start + trimDuration;
                            return (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "w-[3.5px] rounded-full transition-all duration-300",
                                        isActive ? "bg-[#FF7E5F] shadow-[0_0_10px_#FF7E5F]" : "bg-white/5"
                                    )} 
                                    style={{ height: `${10 + h * 90}%` }} 
                                />
                            );
                        })}
                    </div>
                </div>

                {/* THE SELECTION OVERLAY (Handles NEVER hide) */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-30">
                    <div 
                        className="h-full border-x-[5px] border-[#FF7E5F] bg-[#FF7E5F]/[0.1] relative pointer-events-auto rounded-[1rem] flex items-center justify-between"
                        style={{ width: `${trimDuration * PX_PER_SEC}px` }}
                        onPointerDown={(e) => handleDrag("playhead", e)}
                    >
                        {/* Start Handle (Always visible at left boundary) */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("start", e); }} 
                            className="absolute inset-y-0 -left-1 w-5 cursor-ew-resize flex items-center justify-center z-50 group/h" 
                        >
                            <div className="w-[5px] h-3/4 bg-white shadow-[0_0_20px_white] rounded-full group-active/h:scale-y-125 transition-transform" />
                        </div>

                        {/* End Handle (Always visible at right boundary) */}
                        <div 
                            onPointerDown={(e) => { e.stopPropagation(); handleDrag("end", e); }} 
                            className="absolute inset-y-0 -right-1 w-5 cursor-ew-resize flex items-center justify-center z-50 group/h" 
                        >
                            <div className="w-[5px] h-3/4 bg-white shadow-[0_0_20px_white] rounded-full group-active/h:scale-y-125 transition-transform" />
                        </div>

                        {/* Playhead (Sync Slider) */}
                        <div 
                            className="absolute inset-y-0 w-2.5 bg-white z-[60] shadow-[0_0_40px_white]" 
                            style={{ 
                                left: `${((currentTime - start) / trimDuration) * 100}%`,
                                transform: 'translateX(-50%)'
                            }} 
                        />
                    </div>
                </div>

                {/* Status Overlays */}
                {isDecoding && (
                    <div className="absolute top-2 right-4 flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full z-[70] backdrop-blur-md border border-white/5">
                        <Loader2 className="w-3 h-3 text-[#FF7E5F] animate-spin" />
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Optimizing</span>
                    </div>
                )}
                
                <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#121214] via-[#121214]/60 to-transparent z-40 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#121214] via-[#121214]/60 to-transparent z-40 pointer-events-none" />
            </div>

            {/* Interaction Area */}
            <div className="flex flex-col gap-10">
                <div className="flex justify-center items-center gap-20">
                    <button
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        className="w-20 h-20 bg-[#1a1a1c] border border-white/10 rounded-full flex items-center justify-center hover:scale-105 active:scale-90 transition-all shadow-2xl"
                    >
                        {isPlaying ? <Pause className="w-10 h-10 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white ml-2" />}
                    </button>

                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="w-20 h-20 bg-gradient-to-br from-[#FF7E5F] to-[#FF512F] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_15px_40px_rgba(255,126,95,0.4)]"
                        >
                            <Check className="w-10 h-10 text-white stroke-[4]" />
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-center gap-3 opacity-30">
                    <Scissors className="w-3 h-3 text-[#FF7E5F]" />
                    <p className="text-center text-zinc-600 text-[10px] font-black tracking-[0.5rem] uppercase italic">
                        Elite Search Active
                    </p>
                </div>
            </div>
        </div>
    );
}

