"use client";

import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play, Loader2, Sparkles } from "lucide-react";
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
    const [isMuted, setIsMuted] = useState(true);
    const [showComments, setShowComments] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showRepostsSheet, setShowRepostsSheet] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
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

    const handlePlay = async () => {
        if (videoBlobUrl) {
            const video = document.getElementById(`video-${post.id}`) as HTMLVideoElement;
            if (video) {
                if (video.paused) {
                    video.play();
                    setIsPlaying(true);
                } else {
                    video.pause();
                    setIsPlaying(false);
                }
            }
            return;
        }

        setLoadingVideo(true);
        setIsPlaying(true);

        try {
            // "Tod Ke Jodo" download magic ✨
            // Optimization: Single file media doesn't need merging locha
            if (post.media_urls.length === 1) {
                setVideoBlobUrl(post.media_urls[0]);
                return;
            }

            const blobUrl = await downloadAndMergeChunks(
                post.media_urls,
                'video/mp4',
                (progress: number) => {
                    // Optional: Update progress
                }
            );

            setVideoBlobUrl(blobUrl);

        } catch (e) {
            setIsPlaying(false);
            toast.error(t('post.video_load_error'));
        } finally {
            setLoadingVideo(false);
        }
    };

    // Background Music Logic for PostCard
    const audioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        const music = (post as any).customization?.music;
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

        const isMediaActive = post.media_type === 'image' || isPlaying;

        if (isMediaActive && !isMuted) {
            audio.currentTime = startTime;
            audio.play().catch(e => console.log("Post audio blocked", e));
            audio.addEventListener("timeupdate", handleTimeUpdate);
        } else {
            audio.pause();
            audio.removeEventListener("timeupdate", handleTimeUpdate);
        }

        return () => {
            audio.pause();
            audio.removeEventListener("timeupdate", handleTimeUpdate);
        };
    }, [(post as any).customization?.music, isPlaying, isMuted]);

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
                supabase.rpc('increment_karma', { user_id_param: post.user_id }).then(({ error }) => {
                    if (error) console.error("Karma increment failed:", error);
                });

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
                            channel: `notifications-${post.user_id}`,
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

    if (isDeleted) return null;

    return (
        <div className="group relative w-full mb-1">
            {/* Repost Attribution Bar */}
            {(post.repost_of || repostsCount > 0) && (
                <div 
                    onClick={() => setShowRepostsSheet(true)}
                    className="flex items-center gap-2 px-6 py-2 mb-[-12px] relative z-0 bg-zinc-900/30 rounded-t-2xl border-x border-t border-white/5 cursor-pointer hover:bg-zinc-900/50 transition-colors group/repost"
                >
                    <Repeat2 className="w-3.5 h-3.5 text-primary animate-pulse-slow" />
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap">
                            {post.repost_of ? t('post.reposted_by') : (sampleReposter ? t('post.reposted_by') : t('post.reposts_title'))}
                        </span>
                        <span className="text-[10px] font-black text-white truncate max-w-[100px]">
                            {post.repost_of ? post.username : (sampleReposter?.username || '')}
                        </span>
                        {repostsCount > (post.repost_of ? 0 : 1) && (
                            <span className="text-[10px] font-bold text-zinc-500 whitespace-nowrap">
                                + {repostsCount - (post.repost_of ? 0 : 1)} {t('post.others')}
                            </span>
                        )}
                        {originalAuthor && (
                            <>
                                <span className="text-zinc-700 mx-1">•</span>
                                <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap">{t('post.original_by')}</span>
                                <span className="text-[10px] font-black text-primary truncate max-w-[80px]">@{originalAuthor.username}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="group/card w-full overflow-hidden transition-all duration-500 bg-zinc-950/50 border border-white/5 rounded-2xl shadow-premium-md relative z-10">
                {/* 1. Post Header */}
                <div className="flex items-center justify-between p-4 px-5 border-b border-white/[0.05] transition-colors duration-500">
                    <div className="flex items-center gap-3">
                        <Link href={`/profile/${post.user_id}`} className="shrink-0">
                            <StoryAvatar
                                user={{ id: post.user_id, username: post.username, full_name: post.profiles?.full_name, avatar_url: post.avatar_url }}
                                className="w-11 h-11 transition-transform border-premium ring-1 ring-white/10 hover:scale-105"
                            />
                        </Link>
                        <div className="flex flex-col text-left">
                            <div className="flex items-center gap-2">
                                <Link href={`/profile/${post.user_id}`} className="font-display font-bold text-[15px] text-white leading-tight tracking-tight hover:text-primary transition-colors">
                                    {post.profiles?.full_name || post.username}
                                </Link>
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
                            <p className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5 uppercase tracking-widest mt-0.5">
                                <span>@{post.username}</span>
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
                                {!videoBlobUrl ? (
                                    <>
                                        <img
                                            src={post.thumbnail_url || post.media_urls[0]}
                                            style={{
                                                filter: (post as any).customization?.filterStyle || 'none',
                                                clipPath: (post as any).customization?.crop ?
                                                    `inset(${(post as any).customization.crop.y}% ${100 - ((post as any).customization.crop.x + (post as any).customization.crop.w)}% ${100 - ((post as any).customization.crop.y + (post as any).customization.crop.h)}% ${(post as any).customization.crop.x}%)` : 'none'
                                            }}
                                            className="w-full h-full object-cover transition-opacity duration-500"
                                            alt="Video Thumbnail"
                                        />
                                        {!loadingVideo && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-colors">
                                                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
                                                    <Play className="w-8 h-8 fill-white text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <video
                                        id={`video-${post.id}`}
                                        src={videoBlobUrl || undefined}
                                        style={{
                                            filter: (post as any).customization?.filterStyle || 'none',
                                            clipPath: (post as any).customization?.crop ?
                                                `inset(${(post as any).customization.crop.y}% ${100 - ((post as any).customization.crop.x + (post as any).customization.crop.w)}% ${100 - ((post as any).customization.crop.y + (post as any).customization.crop.h)}% ${(post as any).customization.crop.x}%)` : 'none'
                                        }}
                                        autoPlay
                                        loop
                                        muted={isMuted}
                                        className="w-full h-full object-cover animate-in fade-in duration-500"
                                        playsInline
                                    />
                                )}

                                {loadingVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 backdrop-blur-sm">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] animate-pulse">Loading Video...</p>
                                        </div>
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
                    {/* Music Bar if exists */}
                    {(post as any).customization?.music && (
                        <div className="mb-3 flex items-center gap-2.5 px-3 py-2 rounded-xl w-fit bg-white/5 border border-white/5 text-zinc-400 group/music hover:bg-white/[0.08] transition-all cursor-default">
                            {(post as any).customization.music.artwork ? (
                                <img 
                                    src={(post as any).customization.music.artwork} 
                                    alt="" 
                                    className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10 shrink-0" 
                                />
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary shrink-0" />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[200px]">
                                {(post as any).customization.music.name} — {(post as any).customization.music.artist}
                            </span>
                        </div>
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
