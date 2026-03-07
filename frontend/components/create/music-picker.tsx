"use client";

import { useState } from "react";
import { Music, Play, Pause, Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

const MOCK_TRACKS = [
    { id: "1", name: "Starboy", artist: "The Weeknd", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: "3:50" },
    { id: "2", name: "Blinding Lights", artist: "The Weeknd", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: "3:20" },
    { id: "3", name: "Levitating", artist: "Dua Lipa", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", duration: "3:23" },
    { id: "4", name: "Stay", artist: "Justin Bieber", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", duration: "2:21" },
    { id: "5", name: "Industry Baby", artist: "Lil Nas X", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", duration: "3:32" },
];

interface MusicPickerProps {
    onSelect: (track: any) => void;
    selectedTrackId?: string;
}

export function MusicPicker({ onSelect, selectedTrackId }: MusicPickerProps) {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useState(() => typeof Audio !== "undefined" ? new Audio() : null)[0];

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

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Search music..."
                    className="w-full bg-zinc-800/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
            </div>

            <div className="space-y-2">
                {MOCK_TRACKS.map((track) => (
                    <div
                        key={track.id}
                        className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group",
                            selectedTrackId === track.id
                                ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(255,183,77,0.1)]"
                                : "bg-white/5 border-white/5 hover:bg-white/10"
                        )}
                        onClick={() => onSelect(track)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden">
                                <Music className="w-6 h-6 text-zinc-600" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        togglePlay(track);
                                    }}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    {playingId === track.id ? <Pause className="w-5 h-5 text-white fill-current" /> : <Play className="w-5 h-5 text-white fill-current" />}
                                </button>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white leading-tight">{track.name}</h4>
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{track.artist}</p>
                            </div>
                        </div>

                        {selectedTrackId === track.id ? (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                            </div>
                        ) : (
                            <span className="text-[10px] font-mono text-zinc-600">{track.duration}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
