"use client";

import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { cn, formatTimeAgo, sanitizeInput } from "@/lib/utils";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-uploader";
import { CommentSheet } from "@/components/feed/comment-sheet";
import { ShareSheet } from "@/components/feed/share-sheet";
import { PostOptionsSheet } from "@/components/feed/post-options-sheet";
import { toast } from "sonner";
import { getApinatorClient } from "@/lib/apinator";
import Link from "next/link";
import { useTranslation } from "@/components/providers/language-provider";
import { StoryAvatar } from "@/components/ui/story-avatar";

interface PostProps {
    post: {
        id: string;
        user_id: string;
        username: string;
        display_name?: string; // used in stitch feed
        avatar_url: string;
        caption: string;
        media_urls: string[];
        thumbnail_url?: string;
        media_type: 'image' | 'video' | 'text';
        likes_count: number;
        profiles?: { full_name: string };
        created_at: string;
    };
}

export function StitchPostCard({ post }: PostProps) {
    const { user: authUser, supabase } = useAuth();
    const { t } = useTranslation();
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [loadingVideo, setLoadingVideo] = useState(false);
    const [likes, setLikes] = useState(post.likes_count || 0);
    const [liked, setLiked] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showComments, setShowComments] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    
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
                }
            } catch (e) {
                console.warn("Persistence check failed:", e);
            }
        };
        init();

        // Real-time Like Sync (Global)
        const client = getApinatorClient();
        if (client) {
            const channel = client.subscribe(`private-post-${post.id}`);
            channel.bind('like_updated', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (payload.likes !== undefined) setLikes(payload.likes);
                if (payload.actor_id === authUser?.id && payload.liked !== undefined) setLiked(payload.liked);
            });
            return () => { client.unsubscribe(`private-post-${post.id}`); };
        }
    }, [post.id, authUser, supabase]);

    const handlePlay = async () => {
        if (videoBlobUrl) {
            const video = document.getElementById(`stitch-video-${post.id}`) as HTMLVideoElement;
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
            if (post.media_urls.length === 1) {
                setVideoBlobUrl(post.media_urls[0]);
                return;
            }
            const blobUrl = await downloadAndMergeChunks(post.media_urls, 'video/mp4', () => {});
            setVideoBlobUrl(blobUrl);
        } catch (e) {
            setIsPlaying(false);
            toast.error(t('post.video_load_error'));
        } finally {
            setLoadingVideo(false);
        }
    };

    const handleLike = async () => {
        if (!currentUserId) {
            toast.error(t('post.login_to_like'));
            return;
        }

        if (isLikeProcessing.current) return;
        isLikeProcessing.current = true;

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
                const { error: likeError } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId });
                if (likeError && (likeError as any).code !== '23505') throw likeError;
                
                supabase.rpc('increment_karma', { user_id_param: post.user_id }).then();

                if (post.user_id !== currentUserId) {
                    const notifData = { recipient_id: post.user_id, actor_id: currentUserId, type: 'like', entity_id: post.id };
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
                const { error: unlikeError } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
                if (unlikeError) throw unlikeError;
            }

            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-post-${post.id}`,
                    event: 'like_updated',
                    data: { likes: newLikedState ? likes + 1 : likes - 1, actor_id: currentUserId, liked: newLikedState }
                })
            }).catch(console.error);

        } catch (error: any) {
            setLikes(prev => newLikedState ? prev - 1 : prev + 1);
            toast.error(t('post.like_error'));
        } finally {
            isLikeProcessing.current = false;
        }
    };

    if (isDeleted) return null;

    return (
        <article className="glass-panel rounded-3xl overflow-hidden group hover:shadow-[0_20px_50px_rgba(132,85,239,0.1)] transition-all duration-500 border-[#46484c] mb-10 w-full">
            {/* Header */}
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full p-[1px] bg-gradient-to-r from-[#ba9eff] to-[#53ddfc] shrink-0 hover:scale-105 transition-transform z-10 relative">
                        <StoryAvatar 
                            user={{ id: post.user_id, username: post.username, full_name: post.profiles?.full_name, avatar_url: post.avatar_url }}
                            className="w-full h-full object-cover rounded-full" 
                        />
                    </div>
                    <div>
                        <Link href={`/profile/${post.user_id}`} className="font-bold text-sm tracking-tight text-white hover:text-[#ba9eff] transition-colors">
                            {post.display_name || post.profiles?.full_name || post.username}
                        </Link>
                        <p className="text-[10px] text-slate-500">@{post.username} • {post.created_at ? formatTimeAgo(new Date(post.created_at).toISOString()) : 'Just now'}</p>
                    </div>
                </div>
                <PostOptionsSheet
                    post={post}
                    isOwner={currentUserId === post.user_id}
                    onDelete={() => setIsDeleted(true)}
                />
            </div>

            {/* Media */}
            {post.media_type !== 'text' && post.media_urls && post.media_urls.length > 0 && post.media_urls[0] && (
                <div className="relative aspect-square md:aspect-video w-full overflow-hidden bg-black/40 group-media">
                    {post.media_type === 'image' ? (
                        <img 
                            src={post.media_urls[0]} 
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover/media:scale-105" 
                            onDoubleClick={handleLike}
                        />
                    ) : (
                        <div onClick={handlePlay} className="w-full h-full relative cursor-pointer group/video">
                            {!videoBlobUrl ? (
                                <>
                                    <img src={post.thumbnail_url || post.media_urls[0]} className="w-full h-full object-cover transition-opacity duration-500" />
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
                                    id={`stitch-video-${post.id}`}
                                    src={videoBlobUrl}
                                    autoPlay loop muted={isMuted} playsInline
                                    className="w-full h-full object-cover animate-in fade-in duration-500"
                                />
                            )}
                            {loadingVideo && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 backdrop-blur-sm">
                                    <Loader2 className="w-10 h-10 text-[#ba9eff] animate-spin" />
                                </div>
                            )}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                </div>
            )}

            {/* Actions & Caption */}
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-6">
                        <button onClick={handleLike} disabled={isLikeProcessing.current} className="flex items-center gap-2 group/btn transition-all active:scale-90">
                            <Heart className={cn("w-6 h-6 transition-all duration-300", liked ? "fill-[#ff86c3] text-[#ff86c3] scale-110 shadow-[0_0_15px_rgba(255,134,195,0.4)]" : "text-slate-400 group-hover/btn:text-[#ff86c3] group-hover/btn:scale-110")} />
                            <span className={cn("text-xs font-semibold", liked ? "text-[#ff86c3]" : "text-slate-400")}>{likes}</span>
                        </button>
                        <button onClick={() => setShowComments(true)} className="flex items-center gap-2 group/btn transition-all active:scale-90">
                            <MessageCircle className="w-6 h-6 text-slate-400 group-hover/btn:text-[#53ddfc] transition-colors" />
                        </button>
                        <button onClick={() => setShowShareSheet(true)} className="flex items-center gap-2 group/btn transition-all active:scale-90">
                            <Send className="w-6 h-6 text-slate-400 group-hover/btn:text-[#ba9eff] transition-colors" />
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-sm leading-relaxed text-slate-300 font-body">
                        <span className="text-white font-semibold mr-2">{post.username}</span>
                        {sanitizeInput(post.caption)}
                        {/* Tags */}
                        {(post as any).customization?.tags?.length > 0 && (
                            <span className="text-[#53ddfc] ml-2 font-medium break-words">
                                {(post as any).customization.tags.map((t: string) => `#${t} `)}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <CommentSheet postId={post.id} open={showComments} onOpenChange={setShowComments} />
            <ShareSheet open={showShareSheet} onOpenChange={setShowShareSheet} entityType="post" entityId={post.id} />
        </article>
    );
}
