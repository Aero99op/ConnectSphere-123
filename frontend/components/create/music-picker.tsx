"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Music, Play, Pause, Search, Check, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { MusicTrimmer } from "./music-trimmer";

// ─── API Providers ───────────────────────────────────────────────────

interface Track {
    id: string;
    name: string;
    artist: string;
    artwork?: string;
    url: string;
    duration: number;
    source: "itunes";
}

async function searchiTunes(query: string): Promise<Track[]> {
    if (!query || query.trim().length < 2) return [];
    try {
        const encoded = encodeURIComponent(query.trim());
        const res = await fetch(`/api/itunes/search?q=${encoded}`);
        if (!res.ok) return [];
        return await res.json();
    } catch { return []; }
}

// ─── Component ───────────────────────────────────────────────────────
interface MusicPickerProps {
    onSelect: (track: any) => void;
    selectedTrack?: any;
    onClose?: () => void;
}

export function MusicPicker({ onSelect, selectedTrack, onClose }: MusicPickerProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Track[]>([]);
    const [searching, setSearching] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useState(() => typeof Audio !== "undefined" ? new Audio() : null)[0];
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
    const [loadingTrending, setLoadingTrending] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingTrending(true);
            const data = await searchiTunes("Hot Tracks");
            if (!cancelled) {
                setTrendingTracks(data);
                setLoadingTrending(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleSearch = useCallback((value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.trim().length < 2) {
            setResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        debounceRef.current = setTimeout(async () => {
            const data = await searchiTunes(value);
            setResults(data);
            setSearching(false);
        }, 600);
    }, []);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef) {
                audioRef.pause();
                audioRef.src = "";
            }
        };
    }, [audioRef]);

    const togglePlay = (track: Track) => {
        if (!audioRef) return;
        if (playingId === track.id) {
            audioRef.pause();
            setPlayingId(null);
        } else {
            audioRef.preload = "auto";
            audioRef.src = track.url;
            audioRef.play().catch(() => { });
            setPlayingId(track.id);
        }
    };

    const handleSelect = (track: Track) => {
        onSelect(track);
    };

    const displayTracks = query.trim().length >= 2 ? results : trendingTracks;

    return (
        <div className="space-y-4">
            {/* Instagram Style Header */}
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-900/40 rounded-2xl border border-white/5 shadow-inner">
                <Music className="w-6 h-6 text-primary mb-2" />
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Music Library</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Official Licensed Audio</p>
            </div>

            {/* Global Search Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1 group">
                    <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", searching ? "text-primary" : "text-zinc-600")} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search official library..."
                        className="w-full bg-[#121214] border border-white/5 rounded-xl py-3.5 pl-12 pr-12 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-black uppercase font-bold tracking-tight transition-all"
                    />
                    {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
                </div>
            </div>

            {/* Surgical Music Trimmer Integration */}
            {selectedTrack && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                    <MusicTrimmer
                        audioUrl={selectedTrack.url}
                        duration={selectedTrack.duration}
                        onTrimChange={(start, end) => onSelect({ ...selectedTrack, startTime: start, endTime: end })}
                        onConfirm={() => onClose?.()}
                    />
                </div>
            )}

            {/* Unified Result List */}
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto no-scrollbar pr-1 flex-1 min-h-[150px]">
                {displayTracks.length === 0 && !searching ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-8 opacity-20">
                        <Zap className="w-12 h-12 text-zinc-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">No Tracks Found</span>
                    </div>
                ) : (
                    displayTracks.map((track) => (
                        <div
                            key={track.id}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                                selectedTrack?.id === track.id
                                    ? "bg-primary/10 border-primary/30 shadow-[0_10px_30px_rgba(255,183,77,0.05)]"
                                    : "bg-[#161618] border-white/5 hover:border-white/10 hover:bg-[#1c1c1e]"
                            )}
                            onClick={() => handleSelect(track)}
                        >
                            <div className="flex items-center gap-4 min-w-0 flex-1 relative z-10">
                                <div className="relative w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-xl">
                                    {track.artwork ? <img src={track.artwork} alt="" className="w-full h-full object-cover" /> : <Music className="w-5 h-5 text-zinc-700" />}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); togglePlay(track); }}
                                        className={cn(
                                            "absolute inset-0 bg-black/60 flex items-center justify-center transition-all duration-500",
                                            playingId === track.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                        )}
                                    >
                                        {playingId === track.id ? <Pause className="w-6 h-6 text-primary fill-current" /> : <Play className="w-6 h-6 text-white fill-current ml-1" />}
                                    </button>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-black text-white truncate uppercase tracking-tight">{track.name}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[10px] font-mono text-zinc-500 uppercase truncate max-w-[150px]">{track.artist}</p>
                                        <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                        <span className="text-[9px] font-black text-zinc-700 uppercase">iTunes Official</span>
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0 ml-2 relative z-10">
                                {selectedTrack?.id === track.id ? (
                                    <div className="p-1.5 bg-primary rounded-full shadow-lg shadow-primary/20">
                                        <Check className="w-3.5 h-3.5 text-black stroke-[4]" />
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-mono text-zinc-700 font-black">{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="flex items-center justify-between px-2 opacity-40">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">ConnectSphere Music Engine</span>
                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-tighter">iTunes Connect Active</span>
            </div>
        </div>
    );
}
