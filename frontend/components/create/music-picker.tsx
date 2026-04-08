"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Music, Play, Pause, Search, Check, Loader2, Upload, X, Globe, FolderOpen, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadToCatbox } from "@/lib/storage";
import { toast } from "sonner";
import { MusicTrimmer } from "./music-trimmer";

// ─── API Providers ───────────────────────────────────────────────────

interface Track {
    id: string;
    name: string;
    artist: string;
    album?: string;
    artwork?: string;
    url: string;
    duration: number;
    source: "itunes" | "youtube" | "upload";
}

// 1. iTunes Engine
async function searchiTunes(query: string): Promise<Track[]> {
    if (!query || query.trim().length < 2) return [];
    try {
        const encoded = encodeURIComponent(query.trim());
        const res = await fetch(`https://itunes.apple.com/search?term=${encoded}&media=music&entity=song&limit=25`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || [])
            .filter((t: any) => t.previewUrl)
            .map((t: any) => ({
                id: String(t.trackId),
                name: t.trackName,
                artist: t.artistName,
                album: t.collectionName,
                artwork: t.artworkUrl100?.replace("100x100", "300x300"),
                url: t.previewUrl,
                duration: Math.round((t.trackTimeMillis || 30000) / 1000),
                source: "itunes",
            }));
    } catch { return []; }
}

// 2. YouTube Engine (Jugaad via Invidious)
const INVIDIOUS_INSTANCES = [
    "https://invidious.projectsegfau.lt",
    "https://yewtu.be",
    "https://invidious.snopyta.org"
];

async function searchYouTube(query: string): Promise<Track[]> {
    if (!query || query.trim().length < 2) return [];
    try {
        const instance = INVIDIOUS_INSTANCES[0]; // Primary instance
        const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
        if (!res.ok) return [];
        const data = await res.json();
        
        return (data || []).map((v: any) => ({
            id: v.videoId,
            name: v.title,
            artist: v.author,
            artwork: v.videoThumbnails?.find((t: any) => t.quality === "high")?.url || v.videoThumbnails?.[0]?.url,
            // Surgical Link: Gets direct audio stream from the instance
            url: `${instance}/latest_version?id=${v.videoId}&itag=140`,
            duration: v.lengthSeconds || 180,
            source: "youtube",
        }));
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
    const [musicSource, setMusicSource] = useState<"itunes" | "youtube">("youtube");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Track[]>([]);
    const [searching, setSearching] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useState(() => typeof Audio !== "undefined" ? new Audio() : null)[0];
    const [uploading, setUploading] = useState(false);
    const [userTracks, setUserTracks] = useState<Track[]>([]);
    const [trimData, setTrimData] = useState({ start: 0, end: 30 });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Trending / default tracks
    const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
    const [loadingTrending, setLoadingTrending] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingTrending(true);
            const data = musicSource === "itunes" 
                ? await searchiTunes("Arijit Singh") 
                : await searchYouTube("Trending Music");
            if (!cancelled) {
                setTrendingTracks(data);
                setLoadingTrending(false);
            }
        })();
        return () => { cancelled = true; };
    }, [musicSource]);

    useEffect(() => {
        if (selectedTrack && audioRef) {
            audioRef.pause();
            audioRef.src = "";
            setPlayingId(null);
        }
    }, [selectedTrack, audioRef]);

    useEffect(() => {
        return () => {
            if (audioRef) {
                audioRef.pause();
                audioRef.src = "";
            }
        };
    }, [audioRef]);

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
                : await searchYouTube(value);
            setResults(data);
            setSearching(false);
        }, 600);
    }, [musicSource]);

    const togglePlay = (track: Track) => {
        if (!audioRef) return;
        if (playingId === track.id) {
            audioRef.pause();
            setPlayingId(null);
        } else {
            audioRef.src = track.url;
            audioRef.play().catch(() => { });
            setPlayingId(track.id);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            toast.error("File too large! Max 25MB");
            return;
        }
        setUploading(true);
        try {
            const url = await uploadToCatbox(file, { useProxy: true });
            const newTrack: Track = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: "My Music",
                url: url,
                duration: 180,
                source: "upload",
            };
            setUserTracks(prev => [newTrack, ...prev]);
            onSelect(newTrack);
            toast.success("Uploaded! 🎵");
        } catch { toast.error("Upload failed!"); }
        finally { setUploading(false); }
    };

    const displayTracks = activeTab === "uploads" ? userTracks : (query.trim().length >= 2 ? results : trendingTracks);

    return (
        <div className="space-y-4">
            {/* Main Tabs */}
            <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-2xl border border-white/5">
                <button
                    onClick={() => setActiveTab("discover")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === "discover" ? "bg-primary text-black" : "text-zinc-500 hover:text-white"
                    )}
                >
                    <Globe className="w-3.5 h-3.5" /> Discover
                </button>
                <button
                    onClick={() => setActiveTab("uploads")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === "uploads" ? "bg-primary text-black" : "text-zinc-500 hover:text-white"
                    )}
                >
                    <FolderOpen className="w-3.5 h-3.5" /> My Music
                </button>
            </div>

            {/* Source Switcher (Only in Discover) */}
            {activeTab === "discover" && (
                <div className="flex bg-[#1a1a1c] p-1 rounded-xl border border-white/5">
                    <button 
                        onClick={() => { setMusicSource("youtube"); setResults([]); setQuery(""); }}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            musicSource === "youtube" ? "bg-zinc-700 text-white shadow-lg" : "text-zinc-500"
                        )}
                    >
                        <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube Music
                    </button>
                    <button 
                        onClick={() => { setMusicSource("itunes"); setResults([]); setQuery(""); }}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            musicSource === "itunes" ? "bg-zinc-700 text-white shadow-lg" : "text-zinc-500"
                        )}
                    >
                        <Globe className="w-3.5 h-3.5 text-blue-400" /> iTunes 30s
                    </button>
                </div>
            )}

            {/* Search Bar */}
            <div className="flex gap-2">
                {activeTab === "discover" ? (
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={musicSource === 'youtube' ? "Search YouTube, YT Music..." : "Search iTunes results..."}
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
                    </div>
                ) : (
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-1 flex items-center justify-center gap-3 py-3 bg-zinc-800/50 border border-dashed border-white/10 rounded-xl hover:bg-primary/5 transition-all">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Upload className="w-5 h-5 text-zinc-500" />}
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Upload MP3</span>
                    </button>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="audio/*" onChange={handleUpload} />
            </div>

            {/* Trimmer */}
            {selectedTrack && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {selectedTrack.artwork && <img src={selectedTrack.artwork} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                            <div>
                                <p className="text-xs font-bold text-white truncate max-w-[180px]">{selectedTrack.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">{selectedTrack.artist} • {selectedTrack.source.toUpperCase()}</p>
                            </div>
                        </div>
                        <button onClick={() => onSelect(null)} className="p-1.5 rounded-full hover:bg-white/10 text-zinc-500"><X className="w-4 h-4" /></button>
                    </div>
                    <MusicTrimmer
                        audioUrl={selectedTrack.url}
                        duration={selectedTrack.duration}
                        onTrimChange={(start, end) => onSelect({ ...selectedTrack, startTime: start, endTime: end })}
                        onConfirm={() => onClose?.()}
                    />
                </div>
            )}

            {/* Track List */}
            <div className="space-y-1.5 max-h-[25vh] overflow-y-auto no-scrollbar pr-1 flex-1 min-h-0">
                {displayTracks.map((track) => (
                    <div
                        key={track.id}
                        className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group",
                            selectedTrack?.id === track.id ? "bg-primary/15 border-primary/30" : "bg-white/[0.03] border-white/5 hover:border-white/10"
                        )}
                        onClick={() => onSelect(track)}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                {track.artwork ? <img src={track.artwork} alt="" className="w-full h-full object-cover" /> : <Music className="w-5 h-5 text-zinc-600" />}
                                <button onClick={(e) => { e.stopPropagation(); togglePlay(track); }} className={cn("absolute inset-0 bg-black/40 flex items-center justify-center transition-all", playingId === track.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                    {playingId === track.id ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                                </button>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-white truncate">{track.name}</h4>
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5 truncate">{track.artist}</p>
                            </div>
                        </div>
                        <div className="shrink-0 ml-2">
                            {selectedTrack?.id === track.id ? <Check className="w-4 h-4 text-primary" /> : <span className="text-[10px] font-mono text-zinc-600">{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>}
                        </div>
                    </div>
                ))}
            </div>
            
            <p className="text-center text-[9px] font-mono text-zinc-700 tracking-wider">
                {musicSource === 'youtube' ? "Full songs synced via YouTube Music API (Jugaad)" : "30s previews via iTunes Global"}
            </p>
        </div>
    );
}
