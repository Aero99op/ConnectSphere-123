"use client";

import { useState, useEffect } from "react";
import { X, Heart, MessageCircle, Send, MoreHorizontal, ChevronLeft, ChevronRight, Eye, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ShareSheet } from "./share-sheet";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-uploader";

interface StoryViewerProps {
    initialStoryIndex: number;
    stories: any[]; // Array of user stories
    onClose: () => void;
}

export function StoryViewer({ initialStoryIndex, stories, onClose }: StoryViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialStoryIndex);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [liked, setLiked] = useState(false);
    const [comment, setComment] = useState("");
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);

    // Get Auth User once
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserId(data.user.id);
        });
    }, []);

    // Safety check
    if (!stories || stories.length === 0) return null;
    const currentStory = stories[currentIndex];

    // Use currentStory data
    const user = currentStory.username ? {
        username: currentStory.username,
        avatar: currentStory.avatar_url
    } : { username: "User", avatar: "" };

    const mediaUrls = currentStory.media_urls || currentStory.file_urls || (currentStory.media_url ? [currentStory.media_url] : []);
    const mediaType = currentStory.media_type || 'image';

    useEffect(() => {
        // Reset state on slide change
        setProgress(0);
        setLiked(false);
        setPaused(false);
        setComment("");
        setMediaBlobUrl(null);

        // Register View
        async function registerView() {
            if (userId && currentStory.id) {
                // Ignore errors (like duplicate unique view constraint)
                await supabase.from('story_views').insert({
                    story_id: currentStory.id,
                    user_id: userId
                });
            }
        }
        registerView();

        // Handle chunked media merging
        async function loadMedia() {
            if (mediaUrls.length === 0) return;

            // If it's a single image, we can just use the URL directly to be fast.
            // But if it's multiple chunks, we MUST merge.
            if (mediaUrls.length === 1 && mediaType === 'image') {
                setMediaBlobUrl(mediaUrls[0]);
                return;
            }

            setIsLoadingMedia(true);
            setPaused(true); // Pause progress while loading
            try {
                const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
                const blobUrl = await downloadAndMergeChunks(mediaUrls, contentType);
                setMediaBlobUrl(blobUrl);
            } catch (e) {
                console.error("Story Media Load Failed", e);
                toast.error("Media load nahi hua!");
            } finally {
                setIsLoadingMedia(false);
                setPaused(false);
            }
        }

        loadMedia();

    }, [currentIndex, userId, currentStory?.id]);

    useEffect(() => {
        if (paused) return;

        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    nextStory();
                    return 0;
                }
                return prev + 1; // 100 steps * 50ms = 5000ms duration
            });
        }, 50);

        return () => clearInterval(timer);
    }, [currentIndex, paused]);

    const nextStory = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose(); // Close if last story finishes
        }
    };

    const prevStory = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleLike = async () => {
        if (!userId) {
            toast.error("Login to like!");
            return;
        }

        const newLikedState = !liked;
        setLiked(newLikedState);

        if (newLikedState) {
            const { error } = await supabase.from('story_likes').insert({
                story_id: currentStory.id,
                user_id: userId
            });
            if (error && error.code !== '23505') { // Ignore unique violation
                console.error(error);
            }
            toast.success("Loved it! ❤️");

            // Send Notification to Story Owner
            if (currentStory.user_id && currentStory.user_id !== userId) {
                await supabase.from('notifications').insert({
                    user_id: currentStory.user_id,
                    source_user_id: userId,
                    type: 'like',
                    message: `liked your story.`
                });
            }
        } else {
            // Unlike logic
            await supabase.from('story_likes').delete()
                .eq('story_id', currentStory.id)
                .eq('user_id', userId);
            toast.success("Unliked");
        }
    };

    const handleSendComment = async () => {
        if (!comment.trim() || !userId) return;

        // In our current schema we just send a DM basically or a notification
        // For now, we'll log it as a notification "comment" on the story
        const { error } = await supabase.from('notifications').insert({
            user_id: currentStory.user_id,
            source_user_id: userId,
            type: 'comment',
            message: `replied to your story: "${comment}"`
        });

        if (error) {
            toast.error("Failed to send reply");
        } else {
            toast.success("Reply sent! 🚀");
        }

        setComment("");
        setPaused(false); // Resume
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-in fade-in duration-200">
            {/* Desktop Backdrop Blur */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md hidden md:block" onClick={onClose} />

            {/* Main Story Container - Best fit for mobile/desktop aspect ratio */}
            <div className="relative w-full h-full md:w-[400px] md:h-[80vh] bg-zinc-900 md:rounded-2xl overflow-hidden shadow-2xl flex flex-col">

                {/* 1. Progress Bar */}
                <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
                    {stories.map((_, idx) => (
                        <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full bg-white transition-all duration-100 ease-linear",
                                    idx < currentIndex ? "w-full" :
                                        idx === currentIndex ? `w-[${progress}%]` : "w-0" // w-0 is default for future
                                )}
                                style={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }}
                            />
                        </div>
                    ))}
                </div>

                {/* 2. Header (User Info) */}
                <div className="absolute top-4 left-0 right-0 z-20 p-4 pt-6 flex justify-between items-center text-white bg-gradient-to-b from-black/60 to-transparent">
                    <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-orange-500 shadow-xl">
                            <AvatarImage src={user.avatar} className="object-cover" />
                            <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-bold drop-shadow-md">{user.username}</p>
                            <p className="text-xs text-white/80 drop-shadow-md flex items-center gap-1">
                                {currentStory.created_at ? new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-white/20 rounded-full bg-black/20 backdrop-blur-sm" onClick={onClose}>
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* 3. Media Content */}
                <div
                    className="flex-1 relative bg-black flex items-center justify-center"
                    onPointerDown={() => setPaused(true)}
                    onPointerUp={() => setPaused(false)}
                >
                    {/* Navigation Areas */}
                    <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={prevStory} />
                    <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={nextStory} />

                    {/* Image/Video */}
                    {isLoadingMedia ? (
                        <div className="flex flex-col items-center gap-4 text-primary">
                            <Loader2 className="w-10 h-10 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Assembling Chunks...</p>
                        </div>
                    ) : mediaBlobUrl ? (
                        mediaType === 'video' ? (
                            <video
                                src={mediaBlobUrl}
                                className="w-full h-full object-contain"
                                autoPlay
                                loop
                                playsInline
                                muted={false}
                            />
                        ) : (
                            <img src={mediaBlobUrl} className="w-full h-full object-contain" alt="Story" />
                        )
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl px-8 text-center leading-relaxed">
                            {currentStory.caption || "No Media"}
                        </div>
                    )}

                    {/* Caption Overlay */}
                    {currentStory.caption && mediaBlobUrl && (
                        <div className="absolute bottom-24 left-0 right-0 p-4 text-center">
                            <p className="text-white text-[15px] leading-snug font-medium drop-shadow-xl bg-black/60 inline-block px-5 py-2.5 rounded-2xl backdrop-blur-md border border-white/10">
                                {currentStory.caption}
                            </p>
                        </div>
                    )}
                </div>

                {/* 4. Footer Interaction */}
                <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center gap-3">
                    <div className="flex-1 relative">
                        <input
                            placeholder="Send a message..."
                            className="w-full bg-black/40 border border-white/20 rounded-full px-5 py-3 text-sm text-white placeholder-white/60 focus:outline-none focus:border-primary focus:bg-black/60 transition-all backdrop-blur-md shadow-inner"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            onFocus={() => setPaused(true)}
                            onBlur={() => setPaused(false)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                        />
                        {comment && (
                            <button onClick={handleSendComment} className="absolute right-2 top-1/2 -translate-y-1/2 text-primary p-2 font-bold text-sm hover:scale-105 transition-transform">
                                SEND
                            </button>
                        )}
                    </div>

                    <button onClick={handleLike} className="active:scale-90 transition-transform p-3 rounded-full hover:bg-white/10 backdrop-blur-sm">
                        <Heart
                            className={cn("w-7 h-7 drop-shadow-md transition-colors", liked ? "fill-red-500 text-red-500" : "text-white")}
                            strokeWidth={liked ? 0 : 2}
                        />
                    </button>

                    <button onClick={() => { setPaused(true); setShowShareSheet(true); }} className="active:scale-90 transition-transform p-3 rounded-full hover:bg-white/10 backdrop-blur-sm">
                        <Send className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2} />
                    </button>
                </div>
            </div>

            <ShareSheet
                open={showShareSheet}
                onOpenChange={(open) => {
                    setShowShareSheet(open);
                    if (!open) setPaused(false);
                }}
                entityType="story"
                entityId={stories[currentIndex].id}
            />
        </div>
    );
}
