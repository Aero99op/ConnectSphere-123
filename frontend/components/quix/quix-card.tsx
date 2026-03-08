"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, Bookmark, Repeat, Volume2, VolumeX, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/feed/share-sheet";
import { CommentSheet } from "@/components/feed/comment-sheet";
import { toast } from "sonner";
import Link from "next/link";

interface QuixCardProps {
    quix: any;
    isActive: boolean;
}

export function QuixCard({ quix, isActive }: QuixCardProps) {
    const { user, supabase } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isReposted, setIsReposted] = useState(false);
    const [likesCount, setLikesCount] = useState(quix.likes_count || 0);
    const [repostsCount, setRepostsCount] = useState(quix.reposts_count || 0);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    useEffect(() => {
        const music = quix.customization?.music;
        if (music?.url && !audioRef.current) {
            audioRef.current = new Audio(music.url);
        }

        const audio = audioRef.current;
        if (!audio) return;

        const startTime = music?.startTime || 0;
        const endTime = music?.endTime || audio.duration || 999;

        const handleTimeUpdate = () => {
            if (audio.currentTime >= endTime) {
                audio.currentTime = startTime;
            }
        };

        if (isActive) {
            videoRef.current?.play();
            if (!isMuted) {
                audio.currentTime = startTime;
                audio.play().catch(e => console.log("Audio play blocked", e));
                audio.addEventListener("timeupdate", handleTimeUpdate);
            }
        } else {
            videoRef.current?.pause();
            if (videoRef.current) videoRef.current.currentTime = 0;
            audio.pause();
            audio.currentTime = startTime;
            audio.removeEventListener("timeupdate", handleTimeUpdate);
        }

        return () => {
            audio.pause();
            audio.removeEventListener("timeupdate", handleTimeUpdate);
        };
    }, [isActive, isMuted, quix.customization?.music?.url, quix.customization?.music?.startTime, quix.customization?.music?.endTime]);

    useEffect(() => {
        if (isMuted) {
            audioRef.current?.pause();
        } else if (isActive) {
            audioRef.current?.play().catch(e => console.log("Audio play blocked", e));
        }
    }, [isMuted, isActive]);

    useEffect(() => {
        const checkInteractions = async () => {
            if (!user) return;
            const { data: like } = await supabase.from('quix_likes').select('*').eq('quix_id', quix.id).eq('user_id', user.id).maybeSingle();
            setIsLiked(!!like);

            const { data: save } = await supabase.from('quix_bookmarks').select('*').eq('quix_id', quix.id).eq('user_id', user.id).maybeSingle();
            setIsSaved(!!save);

            const { data: repost } = await supabase.from('quix_reposts').select('*').eq('quix_id', quix.id).eq('user_id', user.id).maybeSingle();
            setIsReposted(!!repost);

            const { data: follow } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', quix.user_id).maybeSingle();
            setIsFollowing(!!follow);
        };
        checkInteractions();
    }, [user, quix.id, quix.user_id, supabase]);

    const handleLike = async () => {
        if (!user) return toast.error("Login to like!");
        if (isLiked) {
            setIsLiked(false);
            setLikesCount((prev: number) => prev - 1);
            await supabase.from('quix_likes').delete().eq('quix_id', quix.id).eq('user_id', user.id);
        } else {
            setIsLiked(true);
            setLikesCount((prev: number) => prev + 1);
            await supabase.from('quix_likes').insert({ quix_id: quix.id, user_id: user.id });
            toast.success("Dil khush kar diya! ❤️");
        }
    };

    const handleSave = async () => {
        if (!user) return toast.error("Login to save!");
        if (isSaved) {
            setIsSaved(false);
            await supabase.from('quix_bookmarks').delete().eq('quix_id', quix.id).eq('user_id', user.id);
        } else {
            setIsSaved(true);
            await supabase.from('quix_bookmarks').insert({ quix_id: quix.id, user_id: user.id });
            toast.success("Bookmark lag gaya! 🔖");
        }
    };

    const handleRepost = async () => {
        if (!user) return toast.error("Login to repost!");
        if (isReposted) {
            setIsReposted(false);
            setRepostsCount((prev: number) => prev - 1);
            await supabase.from('quix_reposts').delete().eq('quix_id', quix.id).eq('user_id', user.id);
        } else {
            setIsReposted(true);
            setRepostsCount((prev: number) => prev + 1);
            await supabase.from('quix_reposts').insert({ quix_id: quix.id, user_id: user.id });
            toast.success("Aapki profile pe dikhayega! 🔄");
        }
    };

    const handleFollowToggle = async () => {
        if (!user) return toast.error("Pehle login karle bhai!");
        if (user.id === quix.user_id) return toast.error("Khud ko follow karega? 😂");

        setFollowLoading(true);
        if (isFollowing) {
            const { error } = await supabase.from('follows').delete().match({ follower_id: user.id, following_id: quix.user_id });
            if (!error) {
                setIsFollowing(false);
                toast.success("Unfollow kar diya! 💔");
            }
        } else {
            const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: quix.user_id });
            if (!error) {
                setIsFollowing(true);
                toast.success("Followed! 🚀");
            }
        }
        setFollowLoading(false);
    };

    const handleAddToStory = async () => {
        if (!user) return toast.error("Login to add story!");
        const { error } = await supabase.from('stories').insert({
            user_id: user.id,
            quix_id: quix.id,
            media_url: quix.video_url, // Fallback for old story viewers
            thumbnail_url: quix.thumbnail_url,
            media_type: 'video',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        if (error) {
            toast.error("Story nahi lagi!");
        } else {
            toast.success("Story lag gayi! 🎥");
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current && !isDragging) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    };

    return (
        <div className="relative w-full h-full bg-black snap-start overflow-hidden group">
            <video
                ref={videoRef}
                src={quix.video_url}
                className="h-full w-full object-cover transition-all duration-700"
                style={{
                    filter: quix.customization?.filterStyle || 'none',
                    clipPath: quix.customization?.crop ?
                        `inset(${quix.customization.crop.y}% ${100 - (quix.customization.crop.x + quix.customization.crop.w)}% ${100 - (quix.customization.crop.y + quix.customization.crop.h)}% ${quix.customization.crop.x}%)` : 'none'
                }}
                loop
                muted={isMuted}
                playsInline
                autoPlay
                onDoubleClick={handleLike}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
            />

            {/* Click Hitboxes */}
            <div className="absolute inset-0 flex z-10">
                {/* Center - Play/Pause */}
                <div
                    className="flex-[3] h-full cursor-pointer"
                    onClick={() => {
                        if (videoRef.current?.paused) {
                            videoRef.current.play();
                            audioRef.current?.play().catch(() => { });
                        } else {
                            videoRef.current?.pause();
                            audioRef.current?.pause();
                        }
                    }}
                />
                {/* Right - Mute Toggle */}
                <div
                    className="flex-1 h-full cursor-pointer"
                    onClick={() => setIsMuted(!isMuted)}
                />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

            {/* Mute Indicator */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-active:opacity-100 transition-opacity">
                {isMuted ? <VolumeX className="w-16 h-16 text-white/50" /> : <Volume2 className="w-16 h-16 text-white/50" />}
            </div>

            {/* Right Actions Bar */}
            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-20">
                <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={handleLike}
                        className={cn("p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-75", isLiked ? "text-red-500" : "text-white")}
                    >
                        <Heart className={cn("w-7 h-7", isLiked && "fill-current")} />
                    </button>
                    <span className="text-white text-xs font-bold shadow-sm">{likesCount}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={() => setShowComments(true)}
                        className="p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white transition-all active:scale-75"
                    >
                        <MessageCircle className="w-7 h-7" />
                    </button>
                    <span className="text-white text-xs font-bold shadow-sm">{quix.comments_count || 0}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={handleRepost}
                        className={cn("p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-75", isReposted ? "text-green-500" : "text-white")}
                    >
                        <Repeat className="w-7 h-7" />
                    </button>
                    <span className="text-white text-xs font-bold shadow-sm">{repostsCount}</span>
                </div>

                <button
                    onClick={handleSave}
                    className={cn("p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-75", isSaved ? "text-yellow-500" : "text-white")}
                >
                    <Bookmark className={cn("w-7 h-7", isSaved && "fill-current")} />
                </button>

                <button
                    onClick={() => setShowShareSheet(true)}
                    className="p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white transition-all active:scale-75"
                >
                    <Share2 className="w-7 h-7" />
                </button>

                <button
                    onClick={handleAddToStory}
                    className="p-3 rounded-full bg-gradient-to-tr from-orange-500 to-pink-500 text-black transition-all active:scale-75 shadow-lg shadow-orange-500/20"
                >
                    <Plus className="w-7 h-7 font-black" />
                </button>
            </div>

            <ShareSheet
                open={showShareSheet}
                onOpenChange={setShowShareSheet}
                entityType="quix"
                entityId={quix.id}
            />

            <CommentSheet
                quixId={quix.id}
                open={showComments}
                onOpenChange={setShowComments}
            />

            {/* Bottom Info Bar */}
            <div className="absolute bottom-6 left-4 right-16 z-20">
                <div className="flex items-center gap-3 mb-3">
                    <Link href={`/profile/${quix.user_id}`} className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-white/20">
                            <AvatarImage src={quix.profiles?.avatar_url} />
                            <AvatarFallback className="bg-zinc-800 text-white">{quix.profiles?.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-white font-bold tracking-tight">@{quix.profiles?.username}</span>
                    </Link>
                    {user?.id !== quix.user_id && !isFollowing && (
                        <Button
                            onClick={handleFollowToggle}
                            disabled={followLoading}
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 rounded-full bg-white/10 border-white/20 text-white text-[11px] font-bold hover:bg-white/20"
                        >
                            {followLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Follow"}
                        </Button>
                    )}
                </div>
                <p className="text-white/90 text-[13px] line-clamp-2 leading-relaxed">
                    {quix.caption}
                </p>
                <div className="mt-3 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center animate-spin-slow">
                        <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <span className="text-white/60 text-xs">
                        {quix.customization?.music ? `${quix.customization.music.name} - ${quix.customization.music.artist}` : `Original Audio - ${quix.profiles?.username}`}
                    </span>
                </div>
            </div>

            {/* Progress Slider (YouTube Style) */}
            <div className="absolute bottom-0 left-0 right-0 h-1 z-30 group/slider hover:h-2 transition-all cursor-pointer">
                <input
                    type="range"
                    min="0"
                    max={duration}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSliderChange}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute inset-0 bg-white/20" />
                <div
                    className="absolute inset-y-0 left-0 bg-orange-500 transition-all duration-75"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity shadow-lg"
                    style={{ left: `calc(${(currentTime / duration) * 100}% - 6px)` }}
                />
            </div>

            {/* Stickers Overlay */}
            {quix.customization?.stickers?.map((sticker: any) => (
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
    );
}
