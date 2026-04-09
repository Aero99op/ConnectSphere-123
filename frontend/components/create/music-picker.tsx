"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Music, Play, Pause, Search, Check, Loader2, Upload, X, Globe, FolderOpen, Youtube, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadToCatbox } from "@/lib/storage";
import { toast } from "sonner";
import { MusicTrimmer } from "./music-trimmer";

// ─── API Providers ───────────────────────────────────────────────────

interface Track {
    id: string;
    name: string;
    artist: string;
    artwork?: string;
    url: string;
    duration: number;
    source: "itunes" | "youtube" | "upload";
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

async function searchYouTubeViaProxy(query: string): Promise<Track[]> {
    if (!query || query.trim().length < 2) return [];
    try {
        const res = await fetch(`/api/yt/search?q=${encodeURIComponent(query)}`);
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
    const [activeTab, setActiveTab] = useState<"discover" | "uploads">("discover");
    const [musicSource, setMusicSource] = useState<"itunes" | "youtube">("itunes");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Track[]>([]);
    const [searching, setSearching] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useState(() => typeof Audio !== "undefined" ? new Audio() : null)[0];
    const [uploading, setUploading] = useState(false);
    const [userTracks, setUserTracks] = useState<Track[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
    const [loadingTrending, setLoadingTrending] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingTrending(true);
            const data = musicSource === "itunes" 
                ? await searchiTunes("Hot Tracks") 
                : await searchYouTubeViaProxy("Trending Songs");
            if (!cancelled) {
                setTrendingTracks(data);
                setLoadingTrending(false);
            }
        })();
        return () => { cancelled = true; };
    }, [musicSource]);

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
            const data = musicSource === "itunes" 
                ? await searchiTunes(value) 
                : await searchYouTubeViaProxy(value);
            setResults(data);
            setSearching(false);
        }, 600);
    }, [musicSource]);

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
            audioRef.crossOrigin = "anonymous";
            audioRef.src = track.url;
            audioRef.play().catch(() => { });
            setPlayingId(track.id);
        }
    };

    const handleSelect = (track: Track) => {
        onSelect(track);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadToCatbox(file, { useProxy: true });
            const newTrack: Track = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: "My Uploads",
                url: url,
                duration: 180,
                source: "upload",
            };
            setUserTracks(prev => [newTrack, ...prev]);
            onSelect(newTrack);
            toast.success("Music added! 🎵");
        } catch { toast.error("Upload failed!"); }
        finally { setUploading(false); }
    };

    const displayTracks = activeTab === "uploads" ? userTracks : (query.trim().length >= 2 ? results : trendingTracks);

    return (
        <div className="space-y-4">
            {/* Header Tabs */}
            <div className="flex gap-1 p-1 bg-zinc-800/40 rounded-2xl border border-white/5 shadow-inner">
                <button
                    onClick={() => setActiveTab("discover")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all",
                        activeTab === "discover" ? "bg-primary text-black shadow-lg" : "text-zinc-500 hover:text-white"
                    )}
                >
                    <Globe className="w-3.5 h-3.5" /> Global
                </button>
                <button
                    onClick={() => setActiveTab("uploads")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all",
                        activeTab === "uploads" ? "bg-primary text-black shadow-lg" : "text-zinc-500 hover:text-white"
                    )}
                >
                    <FolderOpen className="w-3.5 h-3.5" /> Vault
                </button>
            </div>

            {/* Source Switcher */}
            {activeTab === "discover" && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                    <button 
                        onClick={() => { setMusicSource("youtube"); setResults([]); setQuery(""); }}
                        className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                            musicSource === "youtube" ? "bg-zinc-800 text-white shadow-[0_0_15px_rgba(255,0,0,0.1)] border border-white/10" : "text-zinc-500 hover:text-zinc-400"
                        )}
                    >
                        <Youtube className="w-4 h-4 text-red-500 fill-red-500" /> YT Music
                    </button>
                    <button 
                        onClick={() => { setMusicSource("itunes"); setResults([]); setQuery(""); }}
                        className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                            musicSource === "itunes" ? "bg-zinc-800 text-white shadow-[0_0_15px_rgba(0,122,255,0.1)] border border-white/10" : "text-zinc-500 hover:text-zinc-400"
                        )}
                    >
                        <Globe className="w-4 h-4 text-blue-400" /> iTunes
                    </button>
                </div>
            )}

            {/* Global Search Bar */}
            <div className="flex gap-2">
                {activeTab === "discover" ? (
                    <div className="relative flex-1 group">
                        <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", searching ? "text-primary" : "text-zinc-600")} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={musicSource === 'youtube' ? "Search YouTube tracks..." : "Search official iTunes..."}
                            className="w-full bg-[#121214] border border-white/5 rounded-xl py-3.5 pl-12 pr-12 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-black uppercase font-bold tracking-tight transition-all"
                        />
                        {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
                    </div>
                ) : (
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-1 flex items-center justify-center gap-3 py-4 bg-zinc-900/60 border border-dashed border-white/5 rounded-xl hover:border-primary/20 hover:bg-primary/5 transition-all text-zinc-500 hover:text-primary">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">Add Custom Audio</span>
                    </button>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="audio/*" onChange={handleUpload} />
            </div>

            {/* Surgical Music Trimmer Integration */}
            {selectedTrack && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-t-[1.5rem] border-x border-t border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                                {selectedTrack.artwork ? <img src={selectedTrack.artwork} alt="" className="w-full h-full object-cover" /> : <Music className="w-full h-full p-2 text-zinc-800 bg-zinc-400" />}
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-xs font-black text-white truncate max-w-[200px] uppercase tracking-tighter">{selectedTrack.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex items-center gap-1 bg-zinc-800/80 px-1.5 py-0.5 rounded text-[8px] font-black text-zinc-500 uppercase">
                                        {selectedTrack.source === 'youtube' ? <Youtube className="w-2 h-2 text-red-500" /> : <Globe className="w-2 h-2 text-blue-400" />}
                                        {selectedTrack.source}
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-600">{Math.floor(selectedTrack.duration / 60)}:{(selectedTrack.duration % 60).toString().padStart(2, '0')}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onSelect(null)} className="p-2 mr-1 rounded-full hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-all"><X className="w-4 h-4" /></button>
                    </div>
                    <MusicTrimmer
                        audioUrl={selectedTrack.url}
                        duration={selectedTrack.duration}
                        onTrimChange={(start, end) => onSelect({ ...selectedTrack, startTime: start, endTime: end })}
                        onConfirm={() => onClose?.()}
                    />
                </div>
            )}

            {/* Unified Result List */}
            <div className="space-y-1.5 max-h-[30vh] overflow-y-auto no-scrollbar pr-1 flex-1 min-h-[150px]">
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
                                        <span className="text-[9px] font-black text-zinc-700 uppercase">
                                            {track.source === 'youtube' ? 'YT Music' : 'iTunes (Preview)'}
                                        </span>
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
                            
                            {/* Animated progress ring if playing */}
                            {playingId === track.id && (
                                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/20">
                                    <div className="h-full bg-primary animate-progress-glow" style={{ width: '100%' }} />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            
            <div className="flex items-center justify-between px-2 opacity-40">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">ConnectSphere Music Engine</span>
                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-tighter">Secure Proxy Active</span>
            </div>
        </div>
    );
}
