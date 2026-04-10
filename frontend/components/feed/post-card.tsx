"use client";

import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play, Pause, Loader2, Sparkles, Music2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { useTheme } from "next-themes";
import { cn, formatTimeAgo, sanitizeInput } from "@/lib/utils";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-uploader";
import { CommentSheet } from "@/components/feed/comment-sheet";
import { ShareSheet } from "@/components/feed/share-sheet";
import { PostOptionsSheet } from "@/components/feed/post-options-sheet";
import { RepostsSheet } from "@/components/feed/reposts-sheet";
import { StoryAvatar } from "@/components/ui/story-avatar";
import { toast } from "sonner";
import { getApinatorClient } from "@/lib/apinator";
import Link from "next/link";
import { useTranslation } from "@/components/providers/language-provider";
import { Repeat2 } from "lucide-react";

interface PostProps {
    post: {
        id: string;
        user_id: string;
        username: string;
        avatar_url: string;
        caption: string;
        media_urls: string[];
        thumbnail_url: string;
        media_type: 'image' | 'video' | 'text';
        likes_count: number;
        profiles?: { full_name: string; username: string };
        created_at?: string;
        repost_of?: string;
    };
}

export function PostCard({ post }: PostProps) {
    const { user: authUser, supabase } = useAuth();
    const { t } = useTranslation();
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [loadingVideo, setLoadingVideo] = useState(false);
    const [likes, setLikes] = useState(post.likes_count);
    const [liked, setLiked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showRepostsSheet, setShowRepostsSheet] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [musicPlaying, setMusicPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const postRef = useRef<HTMLDivElement>(null);
    const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
    const [isFollowingLoading, setIsFollowingLoading] = useState(false);

    // Repost Attribution State
    const [repostsCount, setRepostsCount] = useState(0);
    const [originalAuthor, setOriginalAuthor] = useState<any>(null);
    const [sampleReposter, setSampleReposter] = useState<any>(null);

    const currentUserId = authUser?.id || null;
    const isLikeProcessing = useRef(false);

    // Initial checks for bookmark and ownership + Real-time Sync (Apinator)
    useEffect(() => {
        const init = async () => {
            try {
                if (authUser) {
                    const { data: bookmarkData } = await supabase.from('bookmarks').select('id').eq('post_id', post.id).eq('user_id', authUser.id).maybeSingle();
                    if (bookmarkData) setIsBookmarked(true);

                    const { data: likeData } = await supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', authUser.id).maybeSingle();
                    if (likeData) setLiked(true);

                    // Check Follow Status if not own post
                    if (post.user_id !== authUser.id) {
                        const { data: followData } = await supabase.from('follows').select('follower_id').eq('follower_id', authUser.id).eq('following_id', post.user_id).maybeSingle();
                        setIsFollowing(followData !== null);
                    }
                }

                // Check Repost Attribution
                const targetPostId = post.repost_of || post.id;
                
                // 1. Fetch Reposts Count
                const { count } = await supabase
                    .from('posts')
                    .select('id', { count: 'exact', head: true })
                    .eq('repost_of', targetPostId);
                setRepostsCount(count || 0);

                // 2. Fetch Sample Reposter (different from post owner if possible)
                if ((count || 0) > 0) {
                    const { data: reposterData } = await supabase
                        .from('posts')
                        .select('profiles!user_id(username)')
                        .eq('repost_of', targetPostId)
                        .neq('user_id', post.user_id)
                        .limit(1)
                        .maybeSingle();
                    if (reposterData) setSampleReposter((reposterData as any).profiles);
                }

                // 3. Fetch Original Author if this IS a repost
                if (post.repost_of) {
                    const { data: originalPost } = await supabase
                        .from('posts')
                        .select('profiles!user_id(username, full_name, avatar_url, role)')
                        .eq('id', post.repost_of)
                        .maybeSingle();
                    if (originalPost) setOriginalAuthor((originalPost as any).profiles);
                }

            } catch (e) {
                console.warn("Persistence check failed (Expected if new):", e);
            }
        };
        init();

        // 🟢 Real-time Like Sync (Global)
        const client = getApinatorClient();
        if (client) {
            const channel = client.subscribe(`private-post-${post.id}`);

            channel.bind('like_updated', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;

                // Update count for everyone
                if (payload.likes !== undefined) {
                    setLikes(payload.likes);
                }

                // If WE are the actor in another tab, sync our heart icon too!
                if (payload.actor_id === authUser?.id && payload.liked !== undefined) {
                    setLiked(payload.liked);
                }
            });

            return () => {
                client.unsubscribe(`post-${post.id}`);
            };
        }
    }, [post.id, authUser, supabase]);

    useEffect(() => {
        if (!postRef.current || post.media_type !== 'video') return;

        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && !videoBlobUrl && !loadingVideo) {
                // Trigger auto-load when post enters viewport
                loadVideoContent();
            }
        }, { threshold: 0.1 });

        observer.observe(postRef.current);
        return () => observer.disconnect();
    }, [post.id, videoBlobUrl, loadingVideo]);

    const loadVideoContent = async () => {
        if (videoBlobUrl || loadingVideo) return;
        
        setLoadingVideo(true);
        try {
            if (post.media_urls.length === 1) {
                setVideoBlobUrl(post.media_urls[0]);
                return;
            }

            const blobUrl = await downloadAndMergeChunks(
                post.media_urls,
                'video/mp4',
                () => {}
            );
            setVideoBlobUrl(blobUrl);
        } catch (e) {
            console.error("Video load error", e);
        } finally {
            setLoadingVideo(false);
        }
    };

    const handlePlay = () => {
        const video = document.getElementById(`video-${post.id}`) as HTMLVideoElement;
        if (!video) return;

        if (video.paused) {
            video.play().catch(() => {});
            setIsPlaying(true);
            // Audio will be handled by the useEffect watching isPlaying
        } else {
            video.pause();
            setIsPlaying(false);
            if (audioRef.current) {
                audioRef.current.pause();
                setMusicPlaying(false);
            }
        }
    };

    // 🎵 Unified In-App Library Music Engine (Pure Bawaal Level)
    useEffect(() => {
        const music = (post as any).customization?.music;
        if (!music?.url) return;

        // 1. Creation logic: Create once per post/music URL
        if (!audioRef.current) {
            const newAudio = new Audio();
            newAudio.crossOrigin = "anonymous";
            newAudio.src = music.url;
            newAudio.preload = "auto";
            newAudio.loop = true;
            newAudio.volume = 0.5;
            audioRef.current = newAudio;
        }

        const audio = audioRef.current;
        const video = document.getElementById(`video-${post.id}`) as HTMLVideoElement;
        const startTime = music?.startTime || 0;
        const endTime = music?.endTime || audio.duration || 999;

        const syncMusic = () => {
            if (audio && !isMuted) {
                const musicTrimDuration = endTime - startTime;
                const offset = video ? (video.currentTime % musicTrimDuration) : 0;
                const targetTime = startTime + offset;
                
                if (Math.abs(audio.currentTime - targetTime) > 0.2) {
                    audio.currentTime = targetTime;
                }
            }
        };

        const handleMediaState = () => {
            const isMediaActive = post.media_type === 'image' || (isPlaying && video && !video.paused);
            
            if (isMediaActive && !isMuted) {
                syncMusic();
                audio.play()
                    .then(() => setMusicPlaying(true))
                    .catch((e: any) => {
                        console.log("Post audio blocked", e);
                        setMusicPlaying(false);
                    });
            } else {
                audio.pause();
                setMusicPlaying(false);
            }
        };

        const timeUpdateHandler = () => {
            if (audio.currentTime >= endTime - 0.1) {
                audio.currentTime = startTime;
            }
        };

        // 2. Event Listeners
        audio.addEventListener('timeupdate', timeUpdateHandler);
        
        const videoPlayingHandler = () => { setIsBuffering(false); handleMediaState(); };
        const videoWaitingHandler = () => { setIsBuffering(true); audio.pause(); setMusicPlaying(false); };
        const videoPauseHandler = () => handleMediaState();

        if (video) {
            video.addEventListener('playing', videoPlayingHandler);
            video.addEventListener('waiting', videoWaitingHandler);
            video.addEventListener('pause', videoPauseHandler);
            video.addEventListener('canplay', () => setIsBuffering(false));
        }

        // 3. Intersection Observer (Autoplay/Pause based on visibility)
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (!entry.isIntersecting) {
                audio.pause();
                setMusicPlaying(false);
                if (video && !video.paused) {
                    video.pause();
                    setIsPlaying(false);
                }
            } else {
                handleMediaState();
            }
        }, { threshold: 0.6 });

        if (postRef.current) observer.observe(postRef.current);

        // Initial run
        handleMediaState();

        // 4. Cleanup Logic (Force release resources on unmount)
        return () => {
            observer.disconnect();
            audio.removeEventListener('timeupdate', timeUpdateHandler);
            if (video) {
                video.removeEventListener('playing', videoPlayingHandler);
                video.removeEventListener('waiting', videoWaitingHandler);
                video.removeEventListener('pause', videoPauseHandler);
            }
            audio.pause();
            // Critical fix for persistence: Wipe src and load to tell browser to kill the socket
            audio.src = "";
            audio.load();
            audioRef.current = null; 
        };
    }, [isPlaying, isMuted, post.media_type, videoBlobUrl, post.id, (post as any).customization?.music?.url]);

    const handleLike = async () => {
        if (!currentUserId) {
            toast.error(t('post.login_to_like'));
            return;
        }

        if (isLikeProcessing.current) return;
        isLikeProcessing.current = true;

        // Functional updates for safety with rapid clicks
        let currentLiked: boolean = false;
        setLiked(prev => {
            currentLiked = prev;
            return !prev;
        });

        const newLikedState = !currentLiked;

        setLikes(prev => newLikedState ? prev + 1 : prev - 1);

        if (navigator.vibrate) navigator.vibrate(50);

        try {
            if (newLikedState) {
                // 1. Add to persistent post_likes table
                const { error: likeError } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId });

                // Handle 23505 (Unique violation) — User already liked it, maybe in another tab
                if (likeError && (likeError as any).code !== '23505') {
                    throw likeError;
                }

                // 2. Karma & Notifications (Background)
                fetch('/api/users/karma/increment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: post.user_id })
                }).catch(console.error);

                if (post.user_id !== currentUserId) {
                    const notifData = {
                        recipient_id: post.user_id,
                        actor_id: currentUserId,
                        type: 'like',
                        entity_id: post.id
                    };
                    supabase.from('notifications').insert(notifData).then();
                    fetch('/api/apinator/trigger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channel: `private-notifications-${post.user_id}`,
                            event: 'notification_ping',
                            data: notifData
                        })
                    }).catch(console.error);
                }
            } else {
                // Remove from persistent post_likes table
                const { error: unlikeError } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
                if (unlikeError) throw unlikeError;
            }

            // 🔵 Broadcast Global Like Update (Apinator)
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `post-${post.id}`,
                    event: 'like_updated',
                    data: {
                        likes: newLikedState ? likes + 1 : likes - 1, // We use stable value for broadcast
                        actor_id: currentUserId,
                        liked: newLikedState
                    }
                })
            }).catch(console.error);

        } catch (error: any) {
            console.error("Like Action Failed:", error?.message || error);
            // Rollback functional state
            setLikes(prev => newLikedState ? prev - 1 : prev + 1);
            toast.error(t('post.like_error'));
        } finally {
            isLikeProcessing.current = false;
        }
    };

    const handleBookmark = async () => {
        const newStatus = !isBookmarked;
        setIsBookmarked(newStatus);

        if (newStatus) {
            const { error } = await supabase.from('bookmarks').insert({ post_id: post.id, user_id: currentUserId });
            if (error) {
                setIsBookmarked(!newStatus);
                toast.error(t('post.bookmark_error'));
            } else {
                toast.success(t('post.bookmark_success'));
            }
        } else {
            const { error } = await supabase.from('bookmarks').delete().eq('post_id', post.id);
            if (error) {
                setIsBookmarked(!newStatus);
                toast.error(t('post.bookmark_remove_error'));
            } else {
                toast.success(t('post.bookmark_remove'));
            }
        }
    };

    const handleFollow = async () => {
        if (!currentUserId || !post.user_id) return;
        setIsFollowingLoading(true);

        const { error } = await supabase
            .from('follows')
            // Upsert with ignoreDuplicates gracefully handles 409 Conflict from rapid double-clicks
            .upsert(
                { follower_id: currentUserId, following_id: post.user_id },
                { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
            );

        if (!error) {
            setIsFollowing(true);
            toast.success(`${t('post.follow_success')}@${post.username}`);
        } else {
            console.error("Follow error:", error);
            // If it's a constraint violation it might still be fine, but we assume failure here if it reaches 'else'
            toast.error(t('post.follow_error'));
        }
        setIsFollowingLoading(false);
    };

    const { theme } = useTheme();

    // Music playback handler (Manual Override)
    const toggleMusic = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        if (musicPlaying) {
            audio.pause();
            setMusicPlaying(false);
        } else {
            audio.play().then(() => setMusicPlaying(true)).catch((e) => {
                setMusicPlaying(false);
                toast.error('Browser blocked autoplay! Tap again.');
            });
        }
    };

    if (isDeleted) return null;

    return (
        <div ref={postRef} className="group relative w-full mb-1">

            <div className="group/card w-full overflow-hidden transition-all duration-500 bg-zinc-950/50 border border-white/5 rounded-2xl shadow-premium-md">
                {/* 1. Post Header */}
                <div className="flex items-center justify-between p-4 px-5 border-b border-white/[0.05] transition-colors duration-500">
                    <div className="flex items-center gap-3">
                        {/* Avatar — show original author's avatar for reposts */}
                        <Link href={`/profile/${post.repost_of && originalAuthor ? post.repost_of : post.user_id}`} className="shrink-0">
                            <StoryAvatar
                                user={post.repost_of && originalAuthor 
                                    ? { id: post.repost_of, username: originalAuthor.username, full_name: originalAuthor.full_name, avatar_url: originalAuthor.avatar_url }
                                    : { id: post.user_id, username: post.username, full_name: post.profiles?.full_name, avatar_url: post.avatar_url }
                                }
                                className="w-11 h-11 transition-transform border-premium ring-1 ring-white/10 hover:scale-105"
                            />
                        </Link>
                        <div className="flex flex-col text-left min-w-0">
                            {/* Name Row: Original Author + "and X others" for reposts */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {post.repost_of && originalAuthor ? (
                                    <>
                                        {/* Original author name */}
                                        <Link href={`/profile/${post.repost_of}`} className="font-display font-bold text-[15px] text-white leading-tight tracking-tight hover:text-primary transition-colors">
                                            {originalAuthor.full_name || originalAuthor.username}
                                        </Link>
                                        {/* "and X others" — clickable */}
                                        {repostsCount > 0 && (
                                            <button
                                                onClick={() => setShowRepostsSheet(true)}
                                                className="font-display font-bold text-[15px] text-zinc-400 leading-tight tracking-tight hover:text-primary transition-colors"
                                            >
                                                and <span className="text-white hover:text-primary">{repostsCount} {repostsCount === 1 ? 'other' : 'others'}</span>
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Normal post — show post author */}
                                        <Link href={`/profile/${post.user_id}`} className="font-display font-bold text-[15px] text-white leading-tight tracking-tight hover:text-primary transition-colors">
                                            {post.profiles?.full_name || post.username}
                                        </Link>
                                        {/* "and X others" for original posts that got reposted */}
                                        {repostsCount > 0 && (
                                            <button
                                                onClick={() => setShowRepostsSheet(true)}
                                                className="font-display font-bold text-[15px] text-zinc-400 leading-tight tracking-tight hover:text-primary transition-colors"
                                            >
                                                and <span className="text-white hover:text-primary">{repostsCount} {repostsCount === 1 ? 'other' : 'others'}</span>
                                            </button>
                                        )}
                                    </>
                                )}
                                {currentUserId && currentUserId !== post.user_id && isFollowing === false && (
                                    <>
                                        <span className="text-zinc-500 text-[10px]">•</span>
                                        <button
                                            onClick={handleFollow}
                                            disabled={isFollowingLoading}
                                            className="text-[12px] font-bold text-primary hover:text-white transition-colors tracking-tight flex items-center"
                                        >
                                            {isFollowingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Follow"}
                                        </button>
                                    </>
                                )}
                            </div>
                            {/* Subtitle — date or @username */}
                            <p className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5 mt-0.5">
                                {post.created_at ? (
                                    <span>{new Date(post.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                ) : (
                                    <span className="uppercase tracking-widest">@{post.username}</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <PostOptionsSheet
                        post={post}
                        isOwner={currentUserId === post.user_id}
                        onDelete={() => setIsDeleted(true)}
                    />
                </div>

                {/* 2. Media Content */}
                {post.media_type !== 'text' && post.media_urls && post.media_urls.length > 0 && post.media_urls[0] && (
                    <div className="relative w-full aspect-square md:aspect-[4/5] bg-black/40 overflow-hidden group-media border-b border-white/5">
                        {post.media_type === 'image' ? (
                            <img
                                src={post.media_urls[0]}
                                alt={post.caption}
                                style={{
                                    filter: (post as any).customization?.filterStyle || 'none',
                                    clipPath: (post as any).customization?.crop ?
                                        `inset(${(post as any).customization.crop.y}% ${100 - ((post as any).customization.crop.x + (post as any).customization.crop.w)}% ${100 - ((post as any).customization.crop.y + (post as any).customization.crop.h)}% ${(post as any).customization.crop.x}%)` : 'none'
                                }}
                                className="w-full h-full object-cover select-none transition-transform duration-700 group-hover/card:scale-105"
                                loading="eager"
                                onDoubleClick={handleLike}
                            />
                        ) : (
                            <div onClick={handlePlay} className="w-full h-full relative cursor-pointer group/video">
                                <video
                                    id={`video-${post.id}`}
                                    src={videoBlobUrl || undefined}
                                    poster={post.thumbnail_url || post.media_urls[0]}
                                    style={{
                                        filter: (post as any).customization?.filterStyle || 'none',
                                        clipPath: (post as any).customization?.crop ?
                                            `inset(${(post as any).customization.crop.y}% ${100 - ((post as any).customization.crop.x + (post as any).customization.crop.w)}% ${100 - ((post as any).customization.crop.y + (post as any).customization.crop.h)}% ${(post as any).customization.crop.x}%)` : 'none',
                                        opacity: videoBlobUrl ? 1 : 0.8
                                    }}
                                    preload="metadata"
                                    loop
                                    muted={isMuted}
                                    className="w-full h-full object-cover transition-opacity duration-500"
                                    playsInline
                                    onPause={() => setIsPlaying(false)}
                                    onCanPlay={() => setIsBuffering(false)}
                                    onWaiting={() => setIsBuffering(true)}
                                    onPlaying={() => setIsBuffering(false)}
                                />

                                {isBuffering && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/10 backdrop-blur-[1px]">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                )}

                                {!videoBlobUrl && !loadingVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-colors pointer-events-none">
                                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
                                            <Play className="w-8 h-8 fill-white text-white" />
                                        </div>
                                    </div>
                                )}

                                {loadingVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] z-10">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stickers Overlay */}
                        {(post as any).customization?.stickers?.map((sticker: any) => (
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
                )}

                {/* 3. Action Buttons & Metadata */}
                <div className="p-4 px-5">
                    {/* Music Bar — clickable play/pause */}
                    {(post as any).customization?.music && (
                        <button 
                            onClick={toggleMusic}
                            className={cn(
                                "mb-3 flex items-center gap-2.5 px-3 py-2 rounded-xl w-fit border text-zinc-400 transition-all cursor-pointer active:scale-95",
                                musicPlaying 
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]" 
                                    : "bg-white/5 border-white/5 hover:bg-white/[0.08]"
                            )}
                        >
                            {(post as any).customization.music.artwork ? (
                                <img 
                                    src={(post as any).customization.music.artwork} 
                                    alt="" 
                                    className={cn("w-7 h-7 rounded-lg object-cover ring-1 ring-white/10 shrink-0", musicPlaying && "animate-spin-slow")} 
                                />
                            ) : (
                                <Music2 className={cn("w-4 h-4 shrink-0", musicPlaying && "animate-pulse text-primary")} />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[200px]">
                                {(post as any).customization.music.name} — {(post as any).customization.music.artist}
                            </span>
                            {musicPlaying ? (
                                <Pause className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                                <Play className="w-3.5 h-3.5 shrink-0" />
                            )}
                        </button>
                    )}

                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleLike}
                                disabled={isLikeProcessing.current}
                                className={cn(
                                    "flex items-center gap-2 group/btn transition-all active:scale-90",
                                    liked ? "text-primary" : "text-white hover:opacity-70"
                                )}
                            >
                                <Heart className={cn(
                                    "w-7 h-7 transition-all duration-300",
                                    liked ? "fill-red-500 text-red-500 scale-110" : "group-hover/btn:scale-110"
                                )} />
                            </button>
                            <button onClick={() => setShowComments(true)} className="hover:opacity-70 active:scale-95 transition-all">
                                <MessageCircle className="w-7 h-7 text-white" />
                            </button>
                            <button onClick={() => setShowShareSheet(true)} className="hover:opacity-70 active:scale-95 transition-all">
                                <Send className="w-7 h-7 text-zinc-300 transition-colors" />
                            </button>
                        </div>
                        <button onClick={handleBookmark} className="hover:opacity-70 active:scale-95 transition-all">
                            <Bookmark className={cn(
                                "w-7 h-7 transition-colors",
                                isBookmarked ? "fill-white text-white" : "text-zinc-300"
                            )} />
                        </button>
                    </div>

                    {/* Likes Count */}
                    {likes > 0 && (
                        <div className="font-bold text-sm mb-2 text-zinc-100">
                            {likes.toLocaleString()} {likes === 1 ? 'like' : 'likes'}
                        </div>
                    )}

                    {/* Caption */}
                    <div className="text-sm mb-2 leading-snug text-zinc-300">
                        <span className="font-bold mr-2 text-white">{post.username}</span>
                        {sanitizeInput(post.caption)}
                        {/* Tags if exists */}
                        {(post as any).customization?.tags?.length > 0 && (
                            <span className="text-primary ml-2 font-medium">
                                {(post as any).customization.tags.map((t: string) => `#${t} `)}
                            </span>
                        )}
                    </div>

                    {/* Mentions if exists */}
                    {(post as any).customization?.mentions?.length > 0 && (
                        <div className="text-sm mt-1 mb-2">
                            <span className="text-accent font-medium">
                                {(post as any).customization.mentions.map((m: any) => `@${m.username} `)}
                            </span>
                        </div>
                    )}

                    {/* Time */}
                    <div className="text-[10px] font-medium uppercase tracking-widest mt-2 text-zinc-500">
                        {post.created_at ? formatTimeAgo(post.created_at) : 'JUST NOW'}
                    </div>

                    {/* Quick View Comments */}
                    <button
                        onClick={() => setShowComments(true)}
                        className="text-sm text-zinc-500 hover:text-zinc-400 mt-2 transition-colors font-medium"
                    >
                        View all comments
                    </button>
                </div>
            </div>

            <CommentSheet
                postId={post.id}
                open={showComments}
                onOpenChange={setShowComments}
            />

            <ShareSheet
                open={showShareSheet}
                onOpenChange={setShowShareSheet}
                entityType="post"
                entityId={post.id}
            />

            <RepostsSheet
                open={showRepostsSheet}
                onOpenChange={setShowRepostsSheet}
                entityId={post.repost_of || post.id}
                entityType="post"
            />
        </div>
    );
}
