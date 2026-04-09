"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, Bookmark, Repeat, Volume2, VolumeX, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/feed/share-sheet";
import { CommentSheet } from "@/components/feed/comment-sheet";
import { RepostsSheet } from "@/components/feed/reposts-sheet";
import { useTranslation } from "@/components/providers/language-provider";
import { toast } from "sonner";
import Link from "next/link";
import { QuixOptionsSheet } from "./quix-options-sheet";
import { notifyStoryShare } from "@/lib/utils/mentions";

interface QuixCardProps {
    quix: any;
    isActive: boolean;
    shouldPreload?: boolean;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
}

export function QuixCard({ quix, isActive, shouldPreload, isMuted, setIsMuted }: QuixCardProps) {
    const { user, supabase } = useAuth();
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isReposted, setIsReposted] = useState(false);
    const [likesCount, setLikesCount] = useState(quix.likes_count || 0);
    const [repostsCount, setRepostsCount] = useState(quix.reposts_count || 0);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showRepostsSheet, setShowRepostsSheet] = useState(false);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isAudioBlocked, setIsAudioBlocked] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        const music = quix.customization?.music;

        if (music?.url && !audioRef.current) {
            const newAudio = new Audio();
            newAudio.crossOrigin = "anonymous";
            newAudio.src = music.url;
            newAudio.preload = "auto";
            newAudio.loop = false;
            audioRef.current = newAudio;
        }
        const audio = audioRef.current;

        const startTime = music?.startTime || 0;
        const endTime = music?.endTime || (audio?.duration ?? 999);

        const syncAudioToVideo = () => {
            if (video && audio && !isMuted) {
                const musicTrimDuration = endTime - startTime;
                const targetAudioTime = startTime + (video.currentTime % musicTrimDuration);
                
                if (Math.abs(audio.currentTime - targetAudioTime) > 0.15) {
                    audio.currentTime = targetAudioTime;
                }
            }
        };

        const handleWaiting = () => {
            setIsBuffering(true);
            if (audio) audio.pause();
        };

        const handlePlaying = () => {
            setIsBuffering(false);
            if (isActive && !isMuted && audio && !video?.paused) {
                syncAudioToVideo();
                audio.play().catch((e: any) => console.log("Audio play failed on mobile", e));
            }
        };

        const handleSeeking = () => {
            syncAudioToVideo();
        };

        if (isActive) {
            if (video) {
                video.muted = isMuted;
                video.volume = isMuted ? 0 : 1;
                video.addEventListener("waiting", handleWaiting);
                video.addEventListener("playing", handlePlaying);
                video.addEventListener("seeking", handleSeeking);
                video.play().catch(e => console.log("Video play blocked", e));
            }

            if (audio) {
                audio.muted = isMuted;
                audio.volume = isMuted ? 0 : 0.8;
                if (!isMuted && video && !video.paused) {
                    syncAudioToVideo();
                    audio.play()
                        .then(() => setIsAudioBlocked(false))
                        .catch(e => {
                            console.log("Audio play blocked", e);
                            setIsAudioBlocked(true);
                        });
                } else {
                    audio.pause();
                }
            }
        } else {
            setIsBuffering(false);
            if (video) {
                video.pause();
                video.currentTime = 0;
                video.removeEventListener("waiting", handleWaiting);
                video.removeEventListener("playing", handlePlaying);
                video.removeEventListener("seeking", handleSeeking);
            }
            if (audio) {
                audio.pause();
                audio.currentTime = startTime;
            }
        }

        return () => {
            if (video) {
                video.pause();
                video.removeEventListener("waiting", handleWaiting);
                video.removeEventListener("playing", handlePlaying);
                video.removeEventListener("seeking", handleSeeking);
            }
            if (audio) {
                audio.pause();
                audio.src = "";
                audioRef.current = null;
            }
        };
    }, [isActive, isMuted, quix.id, quix.customization?.music]);

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

        // Sync counts from props but handle active states accurately
        setLikesCount(isLiked ? Math.max(1, quix.likes_count || 0) : (quix.likes_count || 0));
        setRepostsCount(isReposted ? Math.max(1, quix.reposts_count || 0) : (quix.reposts_count || 0));
    }, [user, quix.id, quix.user_id, quix.likes_count, quix.reposts_count, isLiked, isReposted, supabase]);

    const handleLike = async () => {
        if (!user) return toast.error(t('common.login_to_like'));
        if (isLiked) {
            setIsLiked(false);
            setLikesCount((prev: number) => Math.max(0, prev - 1));
            await supabase.from('quix_likes').delete().eq('quix_id', quix.id).eq('user_id', user.id);
        } else {
            setIsLiked(true);
            setLikesCount((prev: number) => prev + 1);
            setShowHeartAnimation(true);
            setTimeout(() => setShowHeartAnimation(false), 800);
            await supabase.from('quix_likes').insert({ quix_id: quix.id, user_id: user.id });
            toast.success(t('quix.liked'));
        }
    };

    const handleSave = async () => {
        if (!user) return toast.error(t('common.login_to_save'));
        if (isSaved) {
            setIsSaved(false);
            await supabase.from('quix_bookmarks').delete().eq('quix_id', quix.id).eq('user_id', user.id);
            toast.success(t('quix.unsaved'));
        } else {
            setIsSaved(true);
            await supabase.from('quix_bookmarks').insert({ quix_id: quix.id, user_id: user.id });
            toast.success(t('quix.saved'));
        }
    };

    const handleRepost = async () => {
        if (!user) return toast.error(t('common.login_to_repost'));
        if (isReposted) {
            setIsReposted(false);
            setRepostsCount((prev: number) => Math.max(0, prev - 1));
            await supabase.from('quix_reposts').delete().eq('quix_id', quix.id).eq('user_id', user.id);
            toast.success(t('quix.unreposted'));
        } else {
            setIsReposted(true);
            setRepostsCount((prev: number) => prev + 1);
            await supabase.from('quix_reposts').insert({ quix_id: quix.id, user_id: user.id });
            toast.success(t('quix.reposted'));
        }
    };

    const handleFollowToggle = async () => {
        if (!user) return toast.error(t('common.login_to_follow'));
        if (user.id === quix.user_id) return toast.error(t('quix.cannot_follow_self'));

        setFollowLoading(true);
        if (isFollowing) {
            const { error } = await supabase.from('follows').delete().match({ follower_id: user.id, following_id: quix.user_id });
            if (!error) {
                setIsFollowing(false);
                toast.success(t('quix.unfollowed'));
            }
        } else {
            const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: quix.user_id });
            if (!error) {
                setIsFollowing(true);
                toast.success(t('quix.followed'));
            }
        }
        setFollowLoading(false);
    };

    const handleAddToStory = async () => {
        if (!user) return toast.error(t('common.login_to_add_story'));
        try {
            const { error } = await supabase.from('stories').insert({
                user_id: user.id,
                media_urls: [quix.video_url],
                media_type: 'video',
                thumbnail_url: quix.thumbnail_url,
                customization: quix.customization || {},
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });

            if (error) throw error;

            // Notify the Quix owner
            await notifyStoryShare(supabase, quix.user_id, user.id, quix.id);

            toast.success(t('quix.share_story'));
        } catch (error: any) {
            toast.error(t('common.error'));
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
                poster={quix.thumbnail_url}
                preload={isActive || shouldPreload ? "auto" : "metadata"}
                className="h-full w-full object-cover transition-all duration-700"
                style={{
                    filter: quix.customization?.filterStyle || 'none',
                    clipPath: quix.customization?.crop ?
                        `inset(${quix.customization.crop.y}% ${100 - (quix.customization.crop.x + quix.customization.crop.w)}% ${100 - (quix.customization.crop.y + quix.customization.crop.h)}% ${quix.customization.crop.x}%)` : 'none'
                }}
                loop
                muted={isMuted || !isActive}
                playsInline
                onDoubleClick={handleLike}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={() => setIsBuffering(false)}
            />

            {/* Buffering Indicator */}
            {isBuffering && isActive && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <Loader2 className="w-12 h-12 text-primary animate-spin opacity-70" />
                </div>
            )}

            {/* Click Hitboxes */}
            <div className="absolute inset-0 flex z-10">
                {/* Center - Play/Pause */}
                <div
                    className="flex-[3] h-full cursor-pointer"
                    onClick={() => {
                        if (videoRef.current?.paused) {
                            videoRef.current.play();
                            if (audioRef.current && !isMuted) {
                                audioRef.current.play().catch((e) => console.log("Audio unlock failed", e));
                            }
                        } else {
                            videoRef.current?.pause();
                            audioRef.current?.pause();
                        }
                    }}
                    onDoubleClick={handleLike}
                />
                {/* Right - Mute Toggle */}
                <div
                    className="flex-1 h-full cursor-pointer"
                    onClick={() => {
                        const newMuted = !isMuted;
                        setIsMuted(newMuted);
                        if (!newMuted && audioRef.current) {
                            audioRef.current.play().catch((e) => console.log("Manual audio unlock failed", e));
                        }
                    }}
                />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

            {/* Mute Indicator / Unlock Overlay for Mobile */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-active:opacity-100 transition-opacity z-20">
                {isMuted ? <VolumeX className="w-16 h-16 text-white/50" /> : <Volume2 className="w-16 h-16 text-white/50" />}
            </div>

            {isAudioBlocked && isActive && (
                <div className="absolute top-4 left-4 z-40 animate-pulse">
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <VolumeX className="w-4 h-4 text-white" />
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Tap to enable sound</span>
                    </div>
                </div>
            )}

            {/* Big Heart Animation */}
            {showHeartAnimation && (
                <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                    <div className="animate-heart-pop">
                        <Heart className="w-32 h-32 text-red-500 fill-current drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
                    </div>
                </div>
            )}

            {/* Right Side Actions - Fixed position to avoid overlap */}
            <div className="absolute right-4 bottom-[90px] flex flex-col items-center gap-4 z-30 animate-in slide-in-from-right duration-500">
                {/* User Avatar & Follow */}
                <div className="flex flex-col items-center gap-1 mb-2">
                    <Link href={`/profile/${quix.user_id}`}>
                        <Avatar className="w-10 h-10 border-2 border-white/20">
                            <AvatarImage src={quix.profiles?.avatar_url} />
                            <AvatarFallback className="bg-zinc-800 text-white">{quix.profiles?.username?.[0]}</AvatarFallback>
                        </Avatar>
                    </Link>
                    {user?.id !== quix.user_id && !isFollowing && (
                        <Button
                            onClick={handleFollowToggle}
                            disabled={followLoading}
                            variant="outline"
                            size="sm"
                            className="absolute -bottom-3 h-5 w-5 rounded-full bg-red-500 border border-black text-white text-[10px] font-bold hover:bg-red-600 flex items-center justify-center p-0"
                        >
                            {followLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        </Button>
                    )}
                </div>

                <div className="flex flex-col items-center gap-0.5">
                    <button
                        onClick={handleLike}
                        className={cn("p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-75", isLiked ? "text-red-500" : "text-white")}
                    >
                        <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
                    </button>
                    <span className="text-white text-[11px] font-bold shadow-sm">{likesCount}</span>
                </div>

                <div className="flex flex-col items-center gap-0.5">
                    <button
                        onClick={() => setShowComments(true)}
                        className="p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white transition-all active:scale-75"
                    >
                        <MessageCircle className="w-6 h-6" />
                    </button>
                    <span className="text-white text-[11px] font-bold shadow-sm">{quix.comments_count || 0}</span>
                </div>

                <div className="flex flex-col items-center gap-0.5">
                    <button
                        onClick={handleRepost}
                        className={cn("p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-75", isReposted ? "text-green-500" : "text-white")}
                    >
                        <Repeat className="w-6 h-6" />
                    </button>
                    <span className="text-white text-[11px] font-bold shadow-sm">{repostsCount}</span>
                </div>

                <button
                    onClick={handleSave}
                    className={cn("p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-75", isSaved ? "text-yellow-500" : "text-white")}
                >
                    <Bookmark className={cn("w-6 h-6", isSaved && "fill-current")} />
                </button>

                <button
                    onClick={() => setShowShareSheet(true)}
                    className="p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white transition-all active:scale-75"
                >
                    <Share2 className="w-6 h-6" />
                </button>

                <QuixOptionsSheet
                    quix={quix}
                    isOwner={user?.id === quix.user_id}
                    onDelete={() => {
                        window.location.reload(); // Simple way to force refresh the feed
                    }}
                />

                <button
                    onClick={handleAddToStory}
                    className="p-2.5 rounded-full bg-gradient-to-tr from-orange-500 to-pink-500 text-black transition-all active:scale-75 shadow-lg shadow-orange-500/20 mt-2"
                >
                    <Plus className="w-6 h-6 font-black" />
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

            <RepostsSheet
                open={showRepostsSheet}
                onOpenChange={setShowRepostsSheet}
                entityType="quix"
                entityId={quix.id}
            />

            <div className="absolute bottom-6 left-4 pr-16 z-20 max-w-[80%]">
                <div className="flex items-center gap-2 mb-2">
                    <Link href={`/profile/${quix.user_id}`} className="flex items-center gap-2">
                        <Avatar className="w-8 h-8 border border-white/20">
                            <AvatarImage src={quix.profiles?.avatar_url} />
                            <AvatarFallback className="bg-zinc-800 text-white text-xs">{quix.profiles?.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-white font-bold tracking-tight text-sm">@{quix.profiles?.username}</span>
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
