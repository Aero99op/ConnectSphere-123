"use client";

import { useEffect, useState, useRef } from "react";
import { X, Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Story {
    id: string;
    media_urls: string[];
    media_type: string;
    created_at: string;
}

interface StoryViewerProps {
    user: {
        id: string;
        username: string;
        full_name?: string;
        avatar_url?: string;
    };
    stories: Story[];
    onClose: () => void;
}

const STORY_DURATION = 5000; // 5 seconds per image

export function StoryViewer({ user, stories, onClose }: StoryViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const progressInterval = useRef<NodeJS.Timeout | null>(null);

    const currentStory = stories[currentIndex];

    useEffect(() => {
        // Prevent scrolling on body
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);

    useEffect(() => {
        if (!currentStory || currentStory.media_type === "video") return;

        if (!isPaused) {
            progressInterval.current = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) {
                        handleNext();
                        return 0;
                    }
                    return prev + (100 / (STORY_DURATION / 50));
                });
            }, 50);
        }

        return () => {
            if (progressInterval.current) clearInterval(progressInterval.current);
        };
    }, [currentIndex, isPaused, currentStory]);

    const handleNext = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setProgress(0);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
            setProgress(0);
        } else {
            setProgress(0);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-0">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 sm:top-8 sm:right-8 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Main Viewer Card */}
            <div className="relative w-full max-w-[450px] aspect-[9/16] bg-black sm:rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 group flex flex-col items-center justify-center">
                
                {/* Progress Bars */}
                <div className="absolute top-4 left-0 right-0 px-4 flex gap-1.5 z-20">
                    {stories.map((_, idx) => (
                        <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full bg-white transition-all duration-75 ease-linear",
                                    idx < currentIndex ? "w-full" : idx === currentIndex ? "w-0" : "w-0"
                                )}
                                style={{ width: idx === currentIndex ? `${progress}%` : undefined }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header Information */}
                <div className="absolute top-8 left-0 right-0 px-4 z-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-primary ring-1 ring-white/20">
                            <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} />
                            <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-bold text-white drop-shadow-md">{user.full_name || user.username}</p>
                            <p className="text-[10px] text-white/70 drop-shadow-md">
                                {new Date(currentStory?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className="p-2 text-white/80 hover:text-white"
                    >
                        {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                    </button>
                </div>

                {/* Media Content */}
                <div 
                    className="absolute inset-0 w-full h-full flex items-center justify-center"
                    onPointerDown={() => setIsPaused(true)}
                    onPointerUp={() => setIsPaused(false)}
                    onPointerLeave={() => setIsPaused(false)}
                >
                    {currentStory?.media_type?.startsWith("image/") || currentStory?.media_type === "image" ? (
                        <img
                            src={currentStory.media_urls[0]}
                            alt="Story"
                            className="w-full h-full object-cover"
                            draggable={false}
                        />
                    ) : currentStory?.media_type?.startsWith("video/") || currentStory?.media_type === "video" ? (
                        <video
                            src={currentStory?.media_urls?.[0]}
                            className="w-full h-full object-cover"
                            autoPlay
                            playsInline
                            webkit-playsinline="true"
                            onEnded={handleNext}
                            onTimeUpdate={(e) => {
                                const target = e.target as HTMLVideoElement;
                                setProgress((target.currentTime / target.duration) * 100);
                            }}
                            onPause={() => setIsPaused(true)}
                            onPlay={() => setIsPaused(false)}
                        />
                    ) : currentStory?.media_type?.startsWith("audio/") ? (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-8 text-center gap-6">
                            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,165,0,0.3)] animate-pulse">
                                <Play className="w-10 h-10 text-primary fill-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Audio Story</h3>
                                <p className="text-xs text-zinc-400 font-mono tracking-widest uppercase">Playing...</p>
                            </div>
                            <audio 
                                src={currentStory.media_urls[0]} 
                                autoPlay 
                                onEnded={handleNext}
                                onTimeUpdate={(e) => {
                                    const target = e.target as HTMLAudioElement;
                                    setProgress((target.currentTime / target.duration) * 100);
                                }}
                                onPause={() => setIsPaused(true)}
                                onPlay={() => setIsPaused(false)}
                                className="hidden"
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-8 text-center gap-6">
                            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
                                <span className="text-3xl font-display font-black text-zinc-500">FILE</span>
                            </div>
                            <div className="max-w-full">
                                <h3 className="text-xl font-bold text-white max-w-full truncate px-4">
                                    {decodeURIComponent(currentStory?.media_urls?.[0]?.split('/').pop() || "Document")}
                                </h3>
                                <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase mt-2">
                                    {currentStory?.media_type || 'Unknown Format'}
                                </p>
                            </div>
                            <a 
                                href={currentStory?.media_urls?.[0]} 
                                target="_blank" 
                                rel="noreferrer"
                                className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full mt-2 hover:scale-105 active:scale-95 transition-all w-[80%]"
                            >
                                Open File
                            </a>
                        </div>
                    )}

                    {/* Left/Right Tap Zones */}
                    <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
                    <div className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
                </div>
            </div>
        </div>
    );
}
