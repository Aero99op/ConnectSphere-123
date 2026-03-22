"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, Bookmark, Repeat, Volume2, VolumeX, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/feed/share-sheet";
import { CommentSheet } from "@/components/feed/comment-sheet";
import { useTranslation } from "@/components/providers/language-provider";
import { toast } from "sonner";
import Link from "next/link";
import { QuixOptionsSheet } from "@/components/quix/quix-options-sheet";
import { notifyStoryShare } from "@/lib/utils/mentions";
import { StoryAvatar } from "@/components/ui/story-avatar";

interface QuixCardProps {
    quix: any;
    isActive: boolean;
}

export function StitchQuixCard({ quix, isActive }: QuixCardProps) {
    const { user, supabase } = useAuth();
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isReposted, setIsReposted] = useState(false);
    const [likesCount, setLikesCount] = useState(quix.likes_count || 0);
    const [repostsCount, setRepostsCount] = useState(quix.reposts_count || 0);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        const music = quix.customization?.music;

        // Initialize custom audio if needed
        if (music?.url && !audioRef.current) {
            audioRef.current = new Audio(music.url);
            audioRef.current.loop = false; // We handle loop via timeupdate/video loop
        }
        const audio = audioRef.current;

        const startTime = music?.startTime || 0;
        const endTime = music?.endTime || (audio?.duration ?? 999);

        const handleAudioLoop = () => {
            if (audio && audio.currentTime >= endTime) {
                audio.currentTime = startTime;
            }
        };

        if (isActive) {
            // PLAYING STATE
            if (video) {
                video.muted = isMuted;
                video.volume = isMuted ? 0 : 1;
                video.play().catch(e => console.log("Video play blocked", e));
            }

            if (audio) {
                if (!isMuted) {
                    audio.currentTime = startTime;
                    audio.play().catch(e => console.log("Audio play blocked", e));
                    audio.addEventListener("timeupdate", handleAudioLoop);
                } else {
                    audio.pause();
                }
            }
        } else {
            // PAUSED/INACTIVE STATE
            if (video) {
                video.pause();
                video.currentTime = 0;
                video.muted = true;
                video.volume = 0;
            }

            if (audio) {
                audio.pause();
                audio.currentTime = startTime;
                audio.removeEventListener("timeupdate", handleAudioLoop);
            }
        }

        return () => {
            if (video) {
                video.pause();
                video.muted = true;
                video.volume = 0;
            }
            if (audio) {
                audio.pause();
                audio.removeEventListener("timeupdate", handleAudioLoop);
            }
        };
    }, [isActive, isMuted, quix.id]); // Explicitly depend on isActive and isMuted

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
        
        const previousLiked = isLiked;
        const previousCount = likesCount;

        // Optimistic UI
        setIsLiked(!previousLiked);
        setLikesCount((prev: number) => !previousLiked ? prev + 1 : Math.max(0, prev - 1));
        
        if (!previousLiked) {
            setShowHeartAnimation(true);
            setTimeout(() => setShowHeartAnimation(false), 800);
        }

        try {
            if (previousLiked) {
                const { error } = await supabase.from('quix_likes').delete().eq('quix_id', quix.id).eq('user_id', user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('quix_likes').insert({ quix_id: quix.id, user_id: user.id });
                if (error) throw error;
                toast.success(t('quix.liked'));
            }
        } catch (error: any) {
            console.error("Like failed:", error);
            // Rollback
            setIsLiked(previousLiked);
            setLikesCount(previousCount);
            toast.error(t('common.error'));
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
        <div className="relative w-full h-full snap-start overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] z-10 group bg-black font-body">
            <style dangerouslySetInnerHTML={{ __html: `
                .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); }
                .neon-text-glow { text-shadow: 0 0 15px rgba(186, 158, 255, 0.4); }
                @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
                .animate-marquee { display: inline-block; padding-left: 100%; animation: marquee 15s linear infinite; }
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 8s linear infinite; }
            `}} />

            <video
                ref={videoRef}
                src={quix.video_url}
                className="absolute inset-0 h-full w-full object-cover transition-all duration-700"
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
            />

            {/* Click Hitboxes */}
            <div className="absolute inset-0 flex z-10">
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
                    onDoubleClick={handleLike}
                />
                <div
                    className="flex-1 h-full cursor-pointer"
                    onClick={() => setIsMuted(!isMuted)}
                />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />

            {/* Mute Indicator */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-active:opacity-100 transition-opacity z-20">
                {isMuted ? <VolumeX className="w-16 h-16 text-white/50" /> : <Volume2 className="w-16 h-16 text-white/50" />}
            </div>

            {/* Big Heart Animation */}
            {showHeartAnimation && (
                <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                    <div className="animate-heart-pop">
                        <Heart className="w-32 h-32 text-red-500 fill-current drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
                    </div>
                </div>
            )}

            {/* Right Side Actions */}
            <div className="absolute right-4 bottom-32 flex flex-col items-center space-y-6 z-30">
                <div onClick={handleLike} className="flex flex-col items-center group/btn cursor-pointer">
                    <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-1 group-active/btn:scale-95 transition-all text-white hover:text-[#ba9eff]">
                        <Heart className={cn("w-6 h-6", isLiked && "fill-[#ba9eff] text-[#ba9eff]")} />
                    </div>
                    <span className="text-[11px] font-bold text-white/90">{likesCount}</span>
                </div>
                <div onClick={() => setShowComments(true)} className="flex flex-col items-center group/btn cursor-pointer">
                    <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-1 group-active/btn:scale-95 transition-all text-white hover:text-[#53ddfc]">
                        <MessageCircle className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-white/90">{quix.comments_count || 0}</span>
                </div>
                <div onClick={() => setShowShareSheet(true)} className="flex flex-col items-center group/btn cursor-pointer">
                    <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-1 group-active/btn:scale-95 transition-all text-white hover:text-[#ff86c3]">
                        <Share2 className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-white/90">Share</span>
                </div>
                {/* Save Bookmarks */}
                <div onClick={handleSave} className="flex flex-col items-center group/btn cursor-pointer">
                    <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-1 group-active/btn:scale-95 transition-all text-white hover:text-yellow-500">
                        <Bookmark className={cn("w-6 h-6", isSaved && "fill-yellow-500 text-yellow-500")} />
                    </div>
                    <span className="text-[11px] font-bold text-white/90">Save</span>
                </div>
                
                <QuixOptionsSheet
                    quix={quix}
                    isOwner={user?.id === quix.user_id}
                    onDelete={() => { window.location.reload(); }}
                />

                <Link href={`/profile/${quix.user_id}`} className="mt-4 group/spin cursor-pointer block hover:scale-105 transition-transform">
                    <div className="w-12 h-12 rounded-full p-1 bg-white/10 backdrop-blur-md animate-spin-slow">
                        <div className="w-full h-full rounded-full overflow-hidden border border-white/20 relative">
                            <img className="absolute inset-0 w-full h-full object-cover" src={quix.profiles?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} />
                        </div>
                    </div>
                </Link>
            </div>

            <ShareSheet open={showShareSheet} onOpenChange={setShowShareSheet} entityType="quix" entityId={quix.id} />
            <CommentSheet quixId={quix.id} open={showComments} onOpenChange={setShowComments} />

            {/* Content Details (Bottom Left) */}
            <div className="absolute left-4 right-20 bottom-8 z-20 flex flex-col space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#ba9eff] to-[#53ddfc] relative z-30">
                        <StoryAvatar 
                            user={{ id: quix.user_id, username: quix.profiles?.username, full_name: quix.profiles?.full_name, avatar_url: quix.profiles?.avatar_url }}
                            className="w-full h-full rounded-full object-cover border-2 border-black/20" 
                        />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center space-x-1">
                            <Link href={`/profile/${quix.user_id}`} className="font-headline font-extrabold text-base tracking-tight text-white neon-text-glow hover:underline hover:text-[#ba9eff]">@{quix.profiles?.username || 'user'}</Link>
                        </div>
                        <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest">{user?.id !== quix.user_id && !isFollowing ? 'New Creator' : 'Following'}</span>
                    </div>
                    {user?.id !== quix.user_id && !isFollowing && (
                        <button onClick={handleFollowToggle} disabled={followLoading} className="ml-2 px-4 py-1.5 rounded-full glass-panel text-[11px] font-bold text-white hover:bg-white/10 transition-colors">
                            {followLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Follow'}
                        </button>
                    )}
                </div>
                <div className="max-w-md">
                    <p className="text-sm text-white/90 leading-relaxed font-body line-clamp-2 md:line-clamp-none">
                        {quix.caption}
                    </p>
                </div>
                {/* Music Info */}
                <div className="flex items-center space-x-2 text-white/70">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.28l8-1.6v5.434A4.369 4.369 0 0015 11c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" /></svg>
                    <div className="overflow-hidden w-48">
                        <div className="text-xs whitespace-nowrap animate-marquee">
                            {quix.customization?.music ? `${quix.customization.music.name} - ${quix.customization.music.artist}` : `Original Audio by @${quix.profiles?.username}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Glowing Progress Bar */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-30 cursor-pointer">
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
                <div className="h-full bg-gradient-to-r from-[#ba9eff] to-[#53ddfc] shadow-[0_0_10px_#53ddfc] transition-all duration-75" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
            </div>
            
            {/* Navigation Scroll Indicators (Visual Flavour) */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col space-y-3 z-50 pointer-events-none hidden md:flex">
                <div className={cn("w-1.5 h-1.5 rounded-full transition-all", isActive ? "h-6 bg-[#ba9eff] shadow-[0_0_8px_#ba9eff]" : "bg-white/20")}></div>
            </div>
        </div>
    );
}
