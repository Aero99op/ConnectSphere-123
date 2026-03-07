"use client";

import { useState, useRef } from "react";
import { Music, Play, Pause, Search, Check, Loader2, Upload, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter } from "@/components/ui/drawer";
import { uploadToCatbox } from "@/lib/storage";
import { toast } from "sonner";
import { MusicTrimmer } from "./music-trimmer";
import { Button } from "@/components/ui/button";

const MOCK_TRACKS = [
    { id: "1", name: "Starboy", artist: "The Weeknd", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: 230 },
    { id: "2", name: "Blinding Lights", artist: "The Weeknd", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: 200 },
    { id: "3", name: "Levitating", artist: "Dua Lipa", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", duration: 203 },
    { id: "4", name: "Stay", artist: "Justin Bieber", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", duration: 141 },
];

interface MusicPickerProps {
    onSelect: (track: any) => void;
    selectedTrack?: any;
}

export function MusicPicker({ onSelect, selectedTrack }: MusicPickerProps) {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useState(() => typeof Audio !== "undefined" ? new Audio() : null)[0];
    const [uploading, setUploading] = useState(false);
    const [userTracks, setUserTracks] = useState<any[]>([]);
    const [trimData, setTrimData] = useState({ start: 0, end: 30 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const togglePlay = (track: any) => {
        if (!audioRef) return;
        if (playingId === track.id) {
            audioRef.pause();
            setPlayingId(null);
        } else {
            audioRef.src = track.url;
            audioRef.play();
            setPlayingId(track.id);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadToCatbox(file, { useProxy: true });
            const newTrack = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: "My Music",
                url: url,
                duration: 180, // Default for now
                isUserUpload: true
            };
            setUserTracks([newTrack, ...userTracks]);
            onSelect(newTrack);
            toast.success("Music uploaded! 🎵");
        } catch (err) {
            toast.error("Upload failed!");
        } finally {
            setUploading(false);
        }
    };

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search tracks..."
                        className="w-full bg-zinc-800/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square w-12 flex items-center justify-center bg-primary rounded-xl text-black hover:opacity-90 active:scale-95 transition-all"
                >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </button>
                <input ref={fileInputRef} type="file" className="hidden" accept="audio/*" onChange={handleUpload} />
            </div>

            {selectedTrack && (
                <div className="animate-in fade-in slide-in-from-top-4">
                    <MusicTrimmer
                        audioUrl={selectedTrack.url}
                        duration={selectedTrack.duration}
                        onTrimChange={(start, end) => {
                            setTrimData({ start, end });
                            onSelect({ ...selectedTrack, startTime: start, endTime: end });
                        }}
                    />
                </div>
            )}

            <div className="space-y-2 max-h-[30vh] overflow-y-auto no-scrollbar pr-1">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">Library</p>
                {[...userTracks, ...MOCK_TRACKS].map((track) => (
                    <div
                        key={track.id}
                        className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group",
                            selectedTrack?.id === track.id
                                ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(255,183,77,0.1)]"
                                : "bg-white/5 border-white/5 hover:bg-white/10"
                        )}
                        onClick={() => onSelect(track)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden">
                                <Music className="w-5 h-5 text-zinc-600" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        togglePlay(track);
                                    }}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    {playingId === track.id ? <Pause className="w-4 h-4 text-white fill-current" /> : <Play className="w-4 h-4 text-white fill-current" />}
                                </button>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white leading-tight">{track.name}</h4>
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{track.artist}</p>
                            </div>
                        </div>

                        {selectedTrack?.id === track.id ? (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-3 text-black stroke-[3]" />
                            </div>
                        ) : (
                            <span className="text-[10px] font-mono text-zinc-600">{formatDuration(track.duration)}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
