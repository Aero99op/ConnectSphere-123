"use client";

import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-uploader";
import { CommentSheet } from "@/components/feed/comment-sheet";
import { ShareSheet } from "@/components/feed/share-sheet";
import { PostOptionsSheet } from "@/components/feed/post-options-sheet";
import { toast } from "sonner";
import { useEffect } from "react";

interface PostProps {
    post: {
        id: string;
        user_id: string;
        username: string;
        avatar_url: string;
        caption: string;
        media_urls: string[];
        thumbnail_url: string;
        media_type: 'image' | 'video';
        likes_count: number;
        profiles?: { full_name: string };
        created_at?: string;
    };
}

export function PostCard({ post }: PostProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [loadingVideo, setLoadingVideo] = useState(false);
    const [likes, setLikes] = useState(post.likes_count);
    const [liked, setLiked] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showComments, setShowComments] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Initial checks for bookmark and ownership
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data: bookmarkData } = await supabase.from('bookmarks').select('id').eq('post_id', post.id).eq('user_id', user.id).single();
                if (bookmarkData) setIsBookmarked(true);

                const { data: likeData } = await supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', user.id).single();
                if (likeData) setLiked(true);
            }
        };
        init();
    }, [post.id]);

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
            const blobUrl = await downloadAndMergeChunks(
                post.media_urls,
                'video/mp4', // Default type, can be dynamic later if needed
                (progress: number) => {
                    // Optional: Update a progress bar state here if we add one to the UI
                }
            );

            setVideoBlobUrl(blobUrl);

        } catch (e) {
            console.error("Video Load Failed", e);
            setIsPlaying(false);
            toast.error("Video load nahi hua! Internet check karo.");
        } finally {
            setLoadingVideo(false);
        }
    };

    const handleLike = async () => {
        if (!currentUserId) {
            toast.error("Please login to like!");
            return;
        }

        const newLikedState = !liked;
        const newLikes = newLikedState ? likes + 1 : likes - 1;

        setLikes(newLikes);
        setLiked(newLikedState);

        if (navigator.vibrate) navigator.vibrate(50);

        // Update total likes count
        const { error: countError } = await supabase
            .from('posts')
            .update({ likes_count: newLikes })
            .eq('id', post.id);

        if (countError) return;

        if (newLikedState) {
            // Add to persistent post_likes table
            await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId });
            await supabase.rpc('increment_karma', { user_id_param: post.user_id });

            // Trigger Notification
            if (post.user_id !== currentUserId) {
                await supabase.from('notifications').insert({
                    recipient_id: post.user_id,
                    actor_id: currentUserId,
                    type: 'like',
                    entity_id: post.id
                });
            }
        } else {
            // Remove from persistent post_likes table
            await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
        }
    };

    const handleBookmark = async () => {
        const newStatus = !isBookmarked;
        setIsBookmarked(newStatus);

        if (newStatus) {
            const { error } = await supabase.from('bookmarks').insert({ post_id: post.id, user_id: (await supabase.auth.getUser()).data.user?.id });
            if (error) {
                setIsBookmarked(!newStatus);
                toast.error("Bookmark fail ho gaya!");
            } else {
                toast.success("Guthri mein daal diya! (Saved)");
            }
        } else {
            const { error } = await supabase.from('bookmarks').delete().eq('post_id', post.id);
            if (error) {
                setIsBookmarked(!newStatus);
                toast.error("Remove nahi ho paya!");
            } else {
                toast.success("Guthri se nikaal diya.");
            }
        }
    };

    if (isDeleted) return null;

    return (
        <div className="group relative w-full mb-1">
            {/* Liquid Glow Underlay */}
            <div className="absolute -inset-2 bg-gradient-to-r from-primary/5 to-secondary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="relative glass-card overflow-hidden border-premium shadow-premium-md">

                {/* 1. Post Header */}
                <div className="flex items-center justify-between p-4 px-5 border-b border-white/[0.05]">
                    <div className="flex items-center gap-3">
                        <Avatar className="w-11 h-11 border-premium ring-1 ring-white/10">
                            <AvatarImage src={post.avatar_url || "https://github.com/shadcn.png"} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400">{post.username?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <h3 className="font-display font-bold text-[15px] text-white leading-tight tracking-tight group-hover:text-primary transition-colors">
                                {post.profiles?.full_name || post.username}
                            </h3>
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
                <div className="relative w-full aspect-square md:aspect-[4/5] bg-black/40 overflow-hidden border-b border-white/5 group-media">
                    {post.media_type === 'image' ? (
                        <img
                            src={post.media_urls[0]}
                            alt={post.caption}
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
                                        className="w-full h-full object-cover transition-opacity duration-500"
                                        alt="Video Thumbnail"
                                    />
                                    {!loadingVideo && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-colors">
                                            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
                                                <Play className="w-8 h-8 text-white fill-white" />
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <video
                                    id={`video-${post.id}`}
                                    src={videoBlobUrl}
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
                </div>

                {/* 3. Action Buttons & Info */}
                <div className="p-5 pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-5">
                            <button onClick={handleLike} className="hover:scale-125 active:scale-95 transition-all duration-300">
                                <Heart className={cn("w-7 h-7 transition-colors duration-300", liked ? "fill-red-500 text-red-500" : "text-zinc-400 hover:text-white")} />
                            </button>
                            <button onClick={() => setShowComments(true)} className="hover:scale-125 active:scale-95 transition-all duration-300">
                                <MessageCircle className="w-7 h-7 text-zinc-400 hover:text-white transition-colors" />
                            </button>
                            <button onClick={() => setShowShareSheet(true)} className="hover:scale-125 active:scale-95 transition-all duration-300 -rotate-12">
                                <Send className="w-7 h-7 text-zinc-400 hover:text-white transition-colors" />
                            </button>
                        </div>
                        <button onClick={handleBookmark} className="hover:scale-125 active:scale-95 transition-all duration-300">
                            <Bookmark className={cn("w-7 h-7 transition-colors duration-300", isBookmarked ? "fill-white text-white" : "text-zinc-400 hover:text-white")} />
                        </button>
                    </div>

                    <div className="space-y-2 px-1">
                        <p className="text-[13px] font-bold text-white tracking-tight">{likes.toLocaleString()} likes</p>
                        <p className="text-[14px] leading-relaxed text-zinc-200 font-sans">
                            <span className="font-display font-bold text-white mr-2 tracking-tight">@{post.username}</span>
                            {post.caption}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-3 opacity-60">2 hours ago</p>
                    </div>
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
        </div>
    );
}
