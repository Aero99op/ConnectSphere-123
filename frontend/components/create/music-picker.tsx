"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Music, Play, Pause, Search, Check, Loader2, Upload, X, Globe, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadToCatbox } from "@/lib/storage";
import { toast } from "sonner";
import { MusicTrimmer } from "./music-trimmer";

// ─── iTunes Search API ───────────────────────────────────────────────
interface iTunesTrack {
    trackId: number;
    trackName: string;
    artistName: string;
    collectionName: string;
    artworkUrl100: string;
    previewUrl: string;
    trackTimeMillis: number;
}

async function searchiTunes(query: string): Promise<iTunesTrack[]> {
    if (!query || query.trim().length < 2) return [];
    try {
        const encoded = encodeURIComponent(query.trim());
        const res = await fetch(
            `https://itunes.apple.com/search?term=${encoded}&media=music&entity=song&limit=25`
        );
        if (!res.ok) return [];
        const data = await res.json();
        // Filter to only results that have a preview URL
        return (data.results || []).filter((t: iTunesTrack) => t.previewUrl);
    } catch {
        return [];
    }
}

// Normalise an iTunes result into our internal track format
function itunesTrackToInternal(t: iTunesTrack) {
    return {
        id: String(t.trackId),
        name: t.trackName,
        artist: t.artistName,
        album: t.collectionName,
        artwork: t.artworkUrl100?.replace("100x100", "300x300"),
        url: t.previewUrl,
        duration: Math.round((t.trackTimeMillis || 30000) / 1000),
        source: "itunes" as const,
    };
}

// ─── Component ───────────────────────────────────────────────────────
interface MusicPickerProps {
    onSelect: (track: any) => void;
    selectedTrack?: any;
    onClose?: () => void;
}

export function MusicPicker({ onSelect, selectedTrack, onClose }: MusicPickerProps) {
    const [activeTab, setActiveTab] = useState<"discover" | "uploads">("discover");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useState(() => typeof Audio !== "undefined" ? new Audio() : null)[0];
    const [uploading, setUploading] = useState(false);
    const [userTracks, setUserTracks] = useState<any[]>([]);
    const [trimData, setTrimData] = useState({ start: 0, end: 30 });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Trending / default tracks (shown before any search)
    const TRENDING_QUERIES = ["Arijit Singh", "AP Dhillon", "Diljit Dosanjh", "Pritam", "Honey Singh"];
    const [trendingTracks, setTrendingTracks] = useState<any[]>([]);
    const [loadingTrending, setLoadingTrending] = useState(true);

    // Load trending on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingTrending(true);
            // Pick a random trending artist for variety
            const randomArtist = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
            const data = await searchiTunes(randomArtist);
            if (!cancelled) {
                setTrendingTracks(data.map(itunesTrackToInternal));
                setLoadingTrending(false);
            }
        })();
        return () => { cancelled = true; };
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

    // ─── Debounced Search ────────────────────────────────────────────
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
            setResults(data.map(itunesTrackToInternal));
            setSearching(false);
        }, 400);
    }, []);

    // ─── Audio Playback ──────────────────────────────────────────────
    const togglePlay = (track: any) => {
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

    // ─── Custom Upload ───────────────────────────────────────────────
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 25 * 1024 * 1024) {
            toast.error("File too large! Max 25MB");
            return;
        }

        setUploading(true);
        try {
            const url = await uploadToCatbox(file, { useProxy: true });

            // Try to get duration from the file
            let duration = 180;
            try {
                const tempAudio = new Audio();
                tempAudio.src = URL.createObjectURL(file);
                await new Promise<void>((resolve) => {
                    tempAudio.onloadedmetadata = () => {
                        duration = Math.round(tempAudio.duration);
                        resolve();
                    };
                    tempAudio.onerror = () => resolve();
                    setTimeout(resolve, 3000); // 3s timeout
                });
            } catch { }

            const newTrack = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: "My Music",
                url: url,
                duration,
                source: "upload" as const,
            };
            setUserTracks(prev => [newTrack, ...prev]);
            onSelect(newTrack);
            toast.success("Music uploaded! 🎵");
        } catch (err) {
            toast.error("Upload failed!");
        } finally {
            setUploading(false);
            // Reset input so same file can be re-uploaded
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    // ─── Which tracks to display ─────────────────────────────────────
    const displayTracks = activeTab === "uploads"
        ? userTracks
        : (query.trim().length >= 2 ? results : trendingTracks);

    return (
        <div className="space-y-4">
            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-2xl border border-white/5">
                <button
                    onClick={() => setActiveTab("discover")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300",
                        activeTab === "discover"
                            ? "bg-primary text-black shadow-[0_0_20px_rgba(255,183,77,0.2)]"
                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                    )}
                >
                    <Globe className="w-3.5 h-3.5" />
                    Discover
                </button>
                <button
                    onClick={() => setActiveTab("uploads")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300",
                        activeTab === "uploads"
                            ? "bg-primary text-black shadow-[0_0_20px_rgba(255,183,77,0.2)]"
                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                    )}
                >
                    <FolderOpen className="w-3.5 h-3.5" />
                    My Music
                </button>
            </div>

            {/* Search / Upload Bar */}
            <div className="flex gap-2">
                {activeTab === "discover" ? (
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search any song, artist..."
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                        {query && (
                            <button
                                onClick={() => { setQuery(""); setResults([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        {searching && (
                            <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex-1 flex items-center justify-center gap-3 py-3 bg-zinc-800/50 border border-dashed border-white/10 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                        {uploading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                            <Upload className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                        )}
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white transition-colors uppercase tracking-widest">
                            {uploading ? "Uploading..." : "Upload MP3 / Audio"}
                        </span>
                    </button>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="audio/*" onChange={handleUpload} />
            </div>

            {/* Selected Track Trimmer */}
            {selectedTrack && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {selectedTrack.artwork && (
                                <img src={selectedTrack.artwork} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            )}
                            <div>
                                <p className="text-xs font-bold text-white truncate max-w-[180px]">{selectedTrack.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">{selectedTrack.artist}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onSelect(null)}
                            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <MusicTrimmer
                        audioUrl={selectedTrack.url}
                        duration={selectedTrack.duration}
                        onTrimChange={(start, end) => {
                            setTrimData({ start, end });
                            onSelect({ ...selectedTrack, startTime: start, endTime: end });
                        }}
                        onConfirm={() => {
                            if (onClose) onClose();
                        }}
                    />
                </div>
            )}

            {/* Section Label */}
            <div className="flex items-center gap-2 px-1">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    {activeTab === "discover"
                        ? (query.trim().length >= 2 ? `Results` : "🔥 Trending")
                        : `Your uploads (${userTracks.length})`
                    }
                </p>
                {activeTab === "discover" && query.trim().length >= 2 && (
                    <span className="text-[9px] font-mono text-zinc-700">{results.length} tracks</span>
                )}
            </div>

            {/* Tracks List */}
            <div className="space-y-1.5 max-h-[25vh] overflow-y-auto no-scrollbar pr-1 flex-1 min-h-0">
                {(activeTab === "discover" && loadingTrending && !query) ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : displayTracks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <Music className="w-8 h-8 text-zinc-700" />
                        <p className="text-xs text-zinc-600 font-mono">
                            {activeTab === "uploads"
                                ? "No uploads yet. Tap above to add!"
                                : (query ? "No results found" : "Search for any song...")
                            }
                        </p>
                    </div>
                ) : (
                    displayTracks.map((track) => (
                        <div
                            key={track.id}
                            className={cn(
                                "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group",
                                selectedTrack?.id === track.id
                                    ? "bg-primary/15 border-primary/30 shadow-[0_0_20px_rgba(255,183,77,0.08)]"
                                    : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
                            )}
                            onClick={() => onSelect(track)}
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Artwork / Icon */}
                                <div className="relative w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white/5">
                                    {track.artwork ? (
                                        <img src={track.artwork} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Music className="w-5 h-5 text-zinc-600" />
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlay(track);
                                        }}
                                        className={cn(
                                            "absolute inset-0 bg-black/40 flex items-center justify-center transition-all duration-300",
                                            playingId === track.id ? "opacity-100 bg-black/60" : "md:opacity-0 md:group-hover:opacity-100 opacity-100"
                                        )}
                                    >
                                        {playingId === track.id
                                            ? <Pause className="w-5 h-5 text-primary fill-current drop-shadow-lg" />
                                            : <Play className="w-5 h-5 text-white fill-current ml-0.5 drop-shadow-lg" />
                                        }
                                    </button>
                                </div>

                                {/* Track Info */}
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-bold text-white leading-tight truncate">{track.name}</h4>
                                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5 truncate">
                                        {track.artist}
                                        {track.album && <span className="text-zinc-700"> · {track.album}</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Right Side */}
                            <div className="shrink-0 ml-2">
                                {selectedTrack?.id === track.id ? (
                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(255,183,77,0.3)]">
                                        <Check className="w-3.5 text-black stroke-[3]" />
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-mono text-zinc-600">{formatDuration(track.duration)}</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* iTunes Attribution */}
            {activeTab === "discover" && (
                <p className="text-center text-[9px] font-mono text-zinc-700 tracking-wider">
                    Powered by iTunes · 30s previews
                </p>
            )}
        </div>
    );
}
