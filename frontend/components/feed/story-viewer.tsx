"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Heart, MessageCircle, Send, MoreHorizontal, ChevronLeft, ChevronRight, Eye, Loader2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { ShareSheet } from "./share-sheet";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-uploader";
import { getApinatorClient } from "@/lib/apinator";

interface StoryViewerProps {
    initialStoryIndex: number;
    stories: any[]; // Array of user stories
    onClose: () => void;
}

export function StoryViewer({ initialStoryIndex, stories, onClose }: StoryViewerProps) {
    const { user: authUser, supabase } = useAuth();
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(initialStoryIndex);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    // Safety check
    if (!stories || stories.length === 0 || !stories[currentIndex]) return null;
    const currentStory = stories[currentIndex];

    // States that depend on currentStory
    const [likes, setLikes] = useState(currentStory.likes_count || 0);
    const [liked, setLiked] = useState(false);
    const [comment, setComment] = useState("");
    const [showShareSheet, setShowShareSheet] = useState(false);
    const userId = authUser?.id || null;
    const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const [isAudioBlocked, setIsAudioBlocked] = useState(false);

    // Use currentStory data with deep safety ✨
    const user = {
        username: currentStory?.username || "Anonymous",
        avatar: currentStory?.avatar_url || ""
    };

    const mediaUrls = currentStory.media_urls || currentStory.file_urls || (currentStory.media_url ? [currentStory.media_url] : []);
    const mediaType = currentStory.media_type || 'image';

    // Registration and Fetching
    useEffect(() => {
        if (!userId || !currentStory.id) return;

        const isMock = currentStory.id && currentStory.id.toString().startsWith('mock');

        // Reset state on slide change
        setProgress(0);
        setLiked(false);
        setLikes(currentStory.likes_count || 0);
        setPaused(false);
        setComment("");
        setMediaBlobUrl(null);

        async function initStory() {
            // 1. Record View (Silent)
            if (!isMock) {
                supabase.from('story_views').insert({ story_id: currentStory.id, viewer_id: userId }).then();
            }

            // 2. Check Like Status
            if (!isMock) {
                const { data: likeData } = await supabase.from('story_likes')
                    .select('id')
                    .eq('story_id', currentStory.id)
                    .eq('user_id', userId)
                    .maybeSingle();
                if (likeData) setLiked(true);
            } else {
                // Juggad: Read mock likes from localStorage
                if (typeof window !== "undefined") {
                    const mockLiked = localStorage.getItem(`mock_like_${currentStory.id}_${userId}`);
                    if (mockLiked === 'true') setLiked(true);
                }
            }
        }

        async function loadMedia() {
            if (mediaUrls.length === 0) return;

            // Optimization: Set src directly if single file to avoid blob delay
            if (mediaUrls.length === 1) {
                setMediaBlobUrl(mediaUrls[0]);
                return;
            }

            // For chunked media, download in background
            setIsLoadingMedia(true);
            try {
                const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
                const blobUrl = await downloadAndMergeChunks(mediaUrls, contentType);
                setMediaBlobUrl(blobUrl);
            } catch (e) {
                console.error("Story Media Load Failed", e);
            } finally {
                setIsLoadingMedia(false);
            }
        }

        // 🟢 Real-time Like Sync (Global)
        const client = getApinatorClient();
        let channel: any = null;
        if (client && !isMock) {
            channel = client.subscribe(`private-story-${currentStory.id}`);
            channel.bind('story_like_updated', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (payload.likes !== undefined) setLikes(payload.likes);

                // Sync heart state for other tabs of same user
                if (payload.actor_id === userId && payload.liked !== undefined) {
                    setLiked(payload.liked);
                }
            });
        }

        initStory();
        loadMedia();

        return () => {
            if (channel) client.unsubscribe(`story-${currentStory.id}`);
        };
    }, [currentIndex, userId, currentStory?.id]);

    useEffect(() => {
        if (paused) return;
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    nextStory();
                    return 0;
                }
                return prev + 1;
            });
        }, 50);
        return () => clearInterval(timer);
    }, [currentIndex, paused, stories.length]); // Added stories.length for safety

    // Background Music for Stories (Strict Lifecycle for Bawaal Performance)
    const audioRef = useRef<HTMLAudioElement | null>(null);
    // Background Music Sync Logic (JHAKAAS Level)
    useEffect(() => {
        const music = currentStory.customization?.music;
        
        if (audioRef.current && audioRef.current.src !== music?.url) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }

        if (music?.url && !audioRef.current) {
            const newAudio = new Audio();
            newAudio.crossOrigin = "anonymous";
            newAudio.src = music.url;
            newAudio.preload = "auto";
            audioRef.current = newAudio;
        }

        const audio = audioRef.current;
        if (!audio) return;

        const startTime = music?.startTime || 0;
        const endTime = music?.endTime || 999;

        const syncMusic = () => {
            if (audio && !paused) {
                const musicTrimDuration = endTime - startTime;
                const video = document.querySelector('video') as HTMLVideoElement;
                const offset = video ? (video.currentTime % musicTrimDuration) : 0;
                const targetTime = startTime + offset;

                if (Math.abs(audio.currentTime - targetTime) > 0.2) {
                    audio.currentTime = targetTime;
                }
                audio.play().catch(() => {});
            }
        };

        const handleBuffering = () => {
            if (audio) audio.pause();
        };

        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) {
            video.addEventListener('waiting', handleBuffering);
            video.addEventListener('playing', syncMusic);
        }

        if (!paused && mediaBlobUrl) {
            syncMusic();
            audio.play()
                .then(() => setIsAudioBlocked(false))
                .catch((e: any) => {
                    console.log("Story audio blocked", e);
                    setIsAudioBlocked(true);
                });
        } else {
            audio.pause();
        }

        return () => {
            if (audio) audio.pause();
            if (video) {
                video.removeEventListener('waiting', handleBuffering);
                video.removeEventListener('playing', syncMusic);
            }
        };
    }, [currentStory.id, paused, mediaBlobUrl]);

    // Component Cleanup: Ensure all audio dies when viewer closes
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
                audioRef.current.load();
            }
        };
    }, []);

    // 🚀 Media Preloader for Next Story (Speed Optimization)
    useEffect(() => {
        const nextIdx = currentIndex + 1;
        if (nextIdx < stories.length) {
            const nextStory = stories[nextIdx];
            const nextUrls = nextStory.media_urls || nextStory.file_urls || (nextStory.media_url ? [nextStory.media_url] : []);
            if (nextUrls.length > 0) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = nextStory.media_type === 'video' ? 'video' : 'image';
                link.href = nextUrls[0];
                document.head.appendChild(link);
                return () => { document.head.removeChild(link); };
            }
        }
    }, [currentIndex, stories]);

    const nextStory = () => {
        if (currentIndex < stories.length - 1) setCurrentIndex(prev => prev + 1);
        else onClose();
    };

    const prevStory = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    const handleLike = async () => {
        if (!userId) return toast.error("Login to like!");

        const newLikedState = !liked;
        const optimisticLikes = newLikedState ? likes + 1 : likes - 1;

        setLiked(newLikedState);
        setLikes(optimisticLikes);

        const isMock = currentStory.id && currentStory.id.toString().startsWith('mock');

        try {
            if (newLikedState) {
                // Only insert into DB if it's not a mock story
                if (!isMock) {
                    const { error } = await supabase.from('story_likes').insert({ story_id: currentStory.id, user_id: userId });
                    if (error) throw error;
                } else {
                    if (typeof window !== "undefined") {
                        localStorage.setItem(`mock_like_${currentStory.id}_${userId}`, 'true');
                    }
                }

                // Real-time Notification logic
                if (currentStory.user_id && currentStory.user_id !== userId) {
                    supabase.from('profiles').select('username, avatar_url').eq('id', userId).single().then(({ data: actorProfile }) => {
                        const notifData = {
                            recipient_id: currentStory.user_id,
                            actor_id: userId,
                            type: 'like',
                            entity_id: currentStory.id,
                            actor: actorProfile || { username: "Someone", avatar_url: "" }
                        };

                        if (!isMock) supabase.from('notifications').insert(notifData).then();

                            fetch('/api/apinator/trigger', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    channel: `private-notifications-${currentStory.user_id}`,
                                    event: 'notification_ping',
                                    data: notifData
                                })
                            }).catch(console.error);
                    });
                }
                toast.success("Loved it! ❤️");
            } else {
                if (!isMock) {
                    const { error } = await supabase.from('story_likes').delete().eq('story_id', currentStory.id).eq('user_id', userId);
                    if (error) throw error;
                } else {
                    if (typeof window !== "undefined") {
                        localStorage.removeItem(`mock_like_${currentStory.id}_${userId}`);
                    }
                }
            }

            // 🔵 Broadcast Global Story Like Update
            if (!isMock) {
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: `story-${currentStory.id}`,
                        event: 'story_like_updated',
                        data: {
                            likes: optimisticLikes,
                            actor_id: userId,
                            liked: newLikedState
                        }
                    })
                }).catch(console.error);
            }
        } catch (error) {
            console.error("Story Like Failed:", error);
            setLiked(liked);
            setLikes(likes);
            toast.error("Like save nahi hua!");
        }
    };

    const handleSendComment = async () => {
        if (!comment.trim() || !userId) return;
        const originalComment = comment;
        setComment(""); // Clear early for speed
        setPaused(false);

        const isMock = currentStory.id && currentStory.id.toString().startsWith('mock');

        try {
            if (isMock) {
                toast.success("Reply saved & DM sent! ✉️");
                return;
            }

            // 1. Save to Story Comments table
            const { error: storyErr } = await supabase.from('story_comments').insert({
                story_id: currentStory.id,
                user_id: userId,
                content: originalComment
            });
            if (storyErr) throw storyErr;

            // 2. DM Logic
            // Find or create conversation
            let { data: conversation } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user1_id.eq.${userId},user2_id.eq.${currentStory.user_id}),and(user1_id.eq.${currentStory.user_id},user2_id.eq.${userId})`)
                .maybeSingle();

            let convId = conversation?.id;
            if (!convId) {
                const { data: newConv, error: convErr } = await supabase
                    .from('conversations')
                    .insert({ user1_id: userId, user2_id: currentStory.user_id })
                    .select('id')
                    .single();
                if (convErr) throw convErr;
                convId = newConv.id;
            }

            // Send actual message
            const { error: msgErr } = await supabase.from('messages').insert({
                conversation_id: convId,
                sender_id: userId,
                content: `Replied to your story: "${originalComment}"`,
                story_id: currentStory.id
            });
            if (msgErr) throw msgErr;

            // 3. Notification Fallback + Signal
            const notifData = {
                recipient_id: currentStory.user_id,
                actor_id: userId,
                type: 'comment',
                entity_id: currentStory.id
            };
            await supabase.from('notifications').insert(notifData);

            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-notifications-${currentStory.user_id}`,
                    event: 'notification_ping',
                    data: notifData
                })
            }).catch(console.error);

            toast.success("Reply saved & DM sent! ✉️");
        } catch (error: any) {
            console.error("Story Interaction Failure:", error);
            toast.error(`Error: ${error.message || "Something went wrong"}`);
            setComment(originalComment); // Restore on failure
        }
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
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => {
                            onClose();
                            if (currentStory.user_id) {
                                router.push(`/profile/${currentStory.user_id}`);
                            }
                        }}
                    >
                        <Avatar className="w-10 h-10 border-2 border-orange-500 shadow-xl transition-transform group-hover:scale-105">
                            <AvatarImage src={user.avatar} className="object-cover" />
                            <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-bold drop-shadow-md group-hover:text-primary transition-colors">{user.username}</p>
                            <div className="flex items-center gap-2 text-xs text-white/80 drop-shadow-md">
                                <span>{currentStory.created_at ? new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                                <span className="text-white/40">•</span>
                                <span className="flex items-center gap-1"><Heart className="w-3 h-3 fill-white/40 text-white/40" /> {likes}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-white/20 rounded-full bg-black/20 backdrop-blur-sm" onClick={onClose}>
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {isAudioBlocked && !paused && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-pulse">
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                            <VolumeX className="w-5 h-5 text-white" />
                            <span className="text-white text-xs font-bold uppercase tracking-widest">Tap to enable audio</span>
                        </div>
                    </div>
                )}

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
                            <div className="w-full h-full relative">
                                <video
                                    src={mediaBlobUrl}
                                    className="w-full h-full object-contain"
                                    style={{ filter: currentStory.customization?.filterStyle || 'none' }}
                                    autoPlay
                                    loop
                                    playsInline
                                    preload="auto"
                                    muted={false}
                                />
                                {currentStory.customization?.stickers?.map((sticker: any) => (
                                    <div
                                        key={sticker.id}
                                        className="absolute pointer-events-none select-none z-10"
                                        style={{
                                            left: `${sticker.x}%`,
                                            top: `${sticker.y}%`,
                                            fontSize: `${sticker.size}px`,
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    >
                                        {sticker.emoji}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="w-full h-full relative">
                                <img
                                    src={mediaBlobUrl}
                                    className="w-full h-full object-contain"
                                    style={{ filter: currentStory.customization?.filterStyle || 'none' }}
                                    alt="Story"
                                />
                                {currentStory.customization?.stickers?.map((sticker: any) => (
                                    <div
                                        key={sticker.id}
                                        className="absolute pointer-events-none select-none z-10"
                                        style={{
                                            left: `${sticker.x}%`,
                                            top: `${sticker.y}%`,
                                            fontSize: `${sticker.size}px`,
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    >
                                        {sticker.emoji}
                                    </div>
                                ))}
                            </div>
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
                    </div>

                    <button onClick={handleLike} className="active:scale-90 transition-transform p-3 rounded-full hover:bg-white/10 backdrop-blur-sm">
                        <Heart
                            className={cn("w-7 h-7 drop-shadow-md transition-colors", liked ? "fill-red-500 text-red-500" : "text-white")}
                            strokeWidth={liked ? 0 : 2}
                        />
                    </button>

                    <button
                        onClick={() => {
                            if (comment.trim()) {
                                handleSendComment();
                            } else {
                                setPaused(true);
                                setShowShareSheet(true);
                            }
                        }}
                        className="active:scale-90 transition-transform p-3 rounded-full hover:bg-white/10 backdrop-blur-sm"
                    >
                        <Send className={cn("w-6 h-6 text-white drop-shadow-md transition-colors", comment.trim() && "text-primary animate-pulse")} strokeWidth={2} />
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
