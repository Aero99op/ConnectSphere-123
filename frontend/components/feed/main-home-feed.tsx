"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { PostCard } from "@/components/feed/post-card";
import { Loader2, Bell, MessageCircle, AlertTriangle, X, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { StoryViewer } from "@/components/feed/story-viewer";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { getApinatorClient } from "@/lib/apinator";

import { FileUpload } from "@/components/ui/file-upload";
import { syncPosts, syncStories, getLocalPosts, getLocalStories, saveLocalProfile, getLocalProfile } from "@/lib/offline-sync";

export function MainHomeFeedContent() {
    const { user: authUser, supabase } = useAuth();
    const [posts, setPosts] = useState<any[]>([]);
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(true);
    const [viewingStoryIndex, setViewingStoryIndex] = useState<number | null>(null);
    const [isAddingStory, setIsAddingStory] = useState(false);
    const userId = authUser?.id || null;
    const [userProfile, setUserProfile] = useState<any>(null);

    const router = useRouter();

    const [isOffline, setIsOffline] = useState(false);

    const fetchStories = async (currentUserId: string | null) => {
        // 1. Load from local DB first
        const localStories = await getLocalStories();
        if (localStories.length > 0) {
             setStories([{
                id: 'add-story-btn',
                user_id: currentUserId,
                username: 'Your Story',
                avatar_url: userProfile?.avatar_url || '',
                isAddButton: true
            }, ...localStories]);
        }

        // 2. Fetch stories that haven't expired
        const { data, error } = await supabase
            .from("stories")
            .select(`
                *,
                profiles (username, avatar_url)
            `)
            .gt('expires_at', new Date().toISOString())
            .order("created_at", { ascending: false });

        let formattedStories: any[] = [];

        if (!error && data && data.length > 0) {
            formattedStories = data.map(story => ({
                ...story,
                username: story.profiles?.username || "User",
                avatar_url: story.profiles?.avatar_url
            }));
            
            // 3. Sync to local DB
            await syncStories(formattedStories);
        }

        // Always put "Add Story" fake object at index 0 for UI purposes
        const myAddStoryCard = {
            id: 'add-story-btn',
            user_id: currentUserId,
            username: 'Your Story',
            avatar_url: userProfile?.avatar_url || '',
            isAddButton: true
        };

        // If no real stories exist, throw in some mocks so the UI doesn't look empty for the demo
        if (formattedStories.length === 0 && localStories.length === 0) {
            formattedStories = [
                { id: 'mock-2', username: 'Riya', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Riya', media_urls: ["https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80"], caption: "Selfie time! 📸" },
                { id: 'mock-3', username: 'Amit', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amit', media_urls: ["https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"], caption: "Nature is healing 🌿" }
            ];
        }

        if (formattedStories.length > 0) {
            setStories([myAddStoryCard, ...formattedStories]);
        }
    };

    const fetchPosts = async () => {
        // 1. Load from local DB first
        const localPosts = await getLocalPosts();
        if (localPosts.length > 0) {
            setPosts(localPosts);
            setLoading(false);
        }

        const { data, error } = await supabase
            .from("posts")
            .select(`
        *,
        profiles (username, avatar_url)
      `)
            .order("created_at", { ascending: false });

        let formattedPosts: any[] = [];

        if (!error && data && data.length > 0) {
            formattedPosts = data.map(post => ({
                ...post,
                username: post.profiles?.username || "Anonymous",
                avatar_url: post.profiles?.avatar_url
            }));

            // 2. Sync to local DB
            await syncPosts(formattedPosts);
        }

        if (formattedPosts.length === 0 && localPosts.length === 0) {
            formattedPosts = [
                {
                    id: "dummy-1",
                    user_id: "system-1",
                    username: "Connect Official",
                    display_name: "Team Connect",
                    avatar_url: "/logo.svg",
                    caption: "Welcome to Connect! 🇮🇳\nThis is India's Premiere Social Media platform. Keep in touch with your community, share stories, and report civic issues directly to the authorities.",
                    media_urls: ["https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=800&q=80"],
                    thumbnail_url: "",
                    media_type: "image",
                    likes_count: 5420,
                    profiles: { full_name: "Team Connect" }
                }
            ];
        }

        if (formattedPosts.length > 0) {
            setPosts(formattedPosts);
        }
        setLoading(false);
    };

    useEffect(() => {
        let feedChannel: any;

        const init = async () => {
            setLoading(true);

            // Network status listeners
            setIsOffline(!navigator.onLine);
            const handleOnline = () => setIsOffline(false);
            const handleOffline = () => setIsOffline(true);
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            if (authUser) {
                try {
                    // 1. Try local profile
                    const localProfile = await getLocalProfile(authUser.id);
                    if (localProfile) setUserProfile(localProfile);

                    const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url, role').eq('id', authUser.id).maybeSingle();
                    if (data) {
                        setUserProfile(data);
                        // 2. Sync to local profile
                        await saveLocalProfile(authUser.id, data);

                        if (data?.role === 'official') {
                            router.push('/dashboard');
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Failed to load user profile for Feed routing:", e);
                }
            }

            // Normal feed initialization
            await Promise.all([fetchPosts(), fetchStories(authUser?.id || null)]);

            setIsInitializing(false);
        };

        init();

        return () => {
            if (feedChannel) {
                supabase.removeChannel(feedChannel);
            }
            window.removeEventListener('online', () => setIsOffline(false));
            window.removeEventListener('offline', () => setIsOffline(true));
        };
    }, [authUser, router, supabase]);

    // 🟢 Real-time Profile Sync (Apinator)
    useEffect(() => {
        const client = getApinatorClient();
        if (!client || !authUser) return;

        const channel = client.subscribe(`private-profiles-${authUser.id}`);
        channel.bind('profile_updated', async (payload: any) => {
            console.log("[Feed] Local profile update received! Syncing header...");
            const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url, role').eq('id', authUser.id).maybeSingle();
            if (data) {
                setUserProfile(data);
            }

            // Also update posts where this user is the author
            const newAvatar = payload?.data?.avatar_url || data?.avatar_url;
            const newName = payload?.data?.full_name || data?.full_name;
            const newUsername = payload?.data?.username || data?.username;

            if (newAvatar || newName || newUsername) {
                setPosts(prev => prev.map(p => {
                    if (p.user_id === authUser.id) {
                        return {
                            ...p,
                            avatar_url: newAvatar || p.avatar_url,
                            username: newUsername || p.username,
                            profiles: {
                                ...p.profiles,
                                full_name: newName || p.profiles?.full_name,
                                username: newUsername || p.profiles?.username,
                                avatar_url: newAvatar || p.profiles?.avatar_url
                            }
                        };
                    }
                    return p;
                }));
            }
        });

        return () => {
            client.unsubscribe(`profiles-${authUser.id}`);
        };
    }, [authUser, supabase]);


    const [storyFileUrls, setStoryFileUrls] = useState<string[]>([]);
    const [storyThumbnailUrl, setStoryThumbnailUrl] = useState<string | undefined>();

    const handleStoryUploadComplete = async (urls: string[], thumbnailUrl?: string) => {
        if (!userId || urls.length === 0) return;
        setStoryFileUrls(urls);
        // if (thumbnailUrl) setStoryThumbnailUrl(thumbnailUrl); // Not used currently but kept for future

        const mediaType = thumbnailUrl ? 'video' : 'image';

        const { error } = await supabase.from("stories").insert({
            user_id: userId,
            media_urls: urls,
            thumbnail_url: thumbnailUrl,
            media_type: mediaType,
        });

        if (error) {
            console.error(error);
            alert("Failed to upload story!");
        } else {
            fetchStories(userId);
            setIsAddingStory(false); // Close Modal
            setStoryFileUrls([]); // Reset for next time
        }
    };

    const { theme } = useTheme();

    if (isInitializing) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-center w-full min-h-screen relative px-2 sm:px-4 md:px-6">
                {/* Theme-Aware Background */}
                <div className="fixed inset-0 z-0 bg-background pointer-events-none">
                    {theme === 'radiant-void' ? (
                        <>
                            {/* Radiant Void - Subtle Light Leaks */}
                            <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] opacity-40 animate-pulse-slow" />
                            <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] opacity-30" />
                            <div className="absolute -bottom-40 left-1/3 w-[700px] h-[700px] bg-accent/5 rounded-full blur-[150px] opacity-20 animate-blob" />
                            {/* Grid Dots */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,_rgba(255,255,255,0.03)_1px,_transparent_0)] bg-[size:40px_40px]" />
                        </>
                    ) : (
                        <>
                            {/* Classic Dark - Indigo/Violet Glow */}
                            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] opacity-50" />
                            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] opacity-30" />
                        </>
                    )}
                </div>

                {/* Feed Container (Center) */}
                <div className="w-full max-w-xl py-4 md:py-8 flex flex-col gap-6 z-10 mx-auto px-4 md:px-0">
                    {/* Top Header for Feed */}
                    <div className="flex items-center justify-between">
                        <h1 className={cn(
                            "text-3xl font-display font-black tracking-tightest",
                            theme === 'radiant-void' ? "text-white uppercase italic" : "text-gradient"
                        )}>
                            Connect
                        </h1>
                        <div className="flex items-center gap-3">
                            {isOffline && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
                                </div>
                            )}
                            <Link href="/notifications" className="relative p-2.5 rounded-2xl glass border-premium hover:bg-white/10 transition-all group active:scale-95 shadow-premium-sm">
                                <Bell className="w-6 h-6 text-zinc-400 group-hover:text-primary group-hover:scale-110 transition-all" />
                                <span className={cn(
                                    "absolute top-2 right-2 w-2.5 h-2.5 border-2 border-black rounded-full animate-pulse",
                                    theme === 'radiant-void' ? "bg-accent shadow-[0_0_10px_rgba(255,109,175,0.5)]" : "bg-primary shadow-[0_0_10px_rgba(255,165,0,0.5)]"
                                )} />
                            </Link>

                            <Link href="/messages" className="relative p-2.5 rounded-2xl glass border-premium hover:bg-white/10 transition-all group active:scale-95 shadow-premium-sm">
                                <MessageCircle className="w-6 h-6 text-zinc-400 group-hover:text-primary group-hover:scale-110 transition-all" />
                            </Link>
                        </div>
                    </div>

                    {/* Stories Rail */}
                    <div className="w-full relative py-2 mb-2 overflow-hidden">
                        <div className="flex gap-5 overflow-x-auto pb-6 pt-2 no-scrollbar mask-fade-right scroll-smooth">
                            {stories.map((story, i) => (
                                <div
                                    key={story.id}
                                    onClick={() => {
                                        if (story.isAddButton) {
                                            userId ? setIsAddingStory(true) : router.push('/login');
                                        } else {
                                            setViewingStoryIndex(i);
                                        }
                                    }}
                                    className="flex flex-col items-center gap-2.5 min-w-[76px] cursor-pointer group active:scale-90 transition-transform"
                                >
                                    <div className={cn(
                                        "relative p-[2.5px] transition-all duration-500",
                                        theme === 'radiant-void' ? "rounded-[12px]" : "rounded-[22px]",
                                        story.isAddButton
                                            ? "bg-zinc-800 border-premium shadow-premium-sm"
                                            : theme === 'radiant-void'
                                                ? "bg-gradient-to-tr from-primary via-secondary to-accent shadow-[0_0_15px_rgba(255,141,135,0.3)] group-hover:shadow-primary/40 animate-pulse-slow"
                                                : "bg-gradient-to-tr from-[#f09433] via-[#bc1888] to-[#962fbf] shadow-premium-lg group-hover:scale-105 group-hover:shadow-primary/20"
                                    )}>
                                        <div className={cn(
                                            "bg-background p-[2.5px]",
                                            theme === 'radiant-void' ? "rounded-[10px]" : "rounded-[20px]"
                                        )}>
                                            <Avatar className={cn(
                                                "w-[64px] h-[64px] border-0 ring-1 ring-white/5",
                                                theme === 'radiant-void' ? "rounded-[8px]" : "rounded-[18px]"
                                            )}>
                                                <AvatarImage src={story.avatar_url} className={cn(
                                                    "object-cover",
                                                    theme === 'radiant-void' ? "rounded-[8px]" : "rounded-[18px]"
                                                )} />
                                                <AvatarFallback className="bg-zinc-900 text-zinc-500 font-display font-bold">{story.username[0]}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        {story.isAddButton && (
                                            <div className="absolute -bottom-1 -right-1 bg-primary text-black rounded-full p-1 border-[3px] border-background shadow-xl group-hover:scale-110 transition-transform">
                                                <Plus className="w-3.5 h-3.5 font-bold" />
                                            </div>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-display font-black text-zinc-500 group-hover:text-white transition-colors tracking-widest uppercase",
                                        theme === 'radiant-void' && "font-mono "
                                    )}>
                                        {story.username === 'Your Story' ? 'My Story' : story.username}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Posts Feed */}
                    <div className="flex flex-col gap-6 md:gap-8 max-w-[470px] mx-auto w-full pb-20">
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            posts.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))
                        )}
                    </div>
                </div>

                {/* Suggestions Sidebar (Desktop Only) */}
                <RightSidebar />
            </div>

            {/* Story Viewer Overlay */}
            {viewingStoryIndex !== null && stories[viewingStoryIndex] && !stories[viewingStoryIndex].isAddButton && (
                <StoryViewer
                    initialStoryIndex={viewingStoryIndex - 1} // Subtract 1 because "Add Story" is filtered out
                    stories={stories.filter(s => !s.isAddButton)}
                    onClose={() => setViewingStoryIndex(null)}
                />
            )}

            {/* Add Story Upload Modal */}
            {isAddingStory && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-md bg-background border border-white/10 rounded-[32px] p-6 relative shadow-2xl">
                        <button
                            onClick={() => setIsAddingStory(false)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6 text-center">
                            <h3 className="text-xl font-display font-black text-white">Add New Story</h3>
                            <p className="text-zinc-500 text-xs mt-1">Share what's happening now</p>
                        </div>

                        <div className="bg-black/30 rounded-2xl p-2 border border-white/5">
                            {storyFileUrls.length === 0 ? (
                                <FileUpload
                                    onUploadComplete={handleStoryUploadComplete}
                                    maxSizeMB={50}
                                />
                            ) : (
                                <div className="p-10 text-center animate-in fade-in zoom-in-95">
                                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">Story Locked 🔒</p>
                                    <p className="text-white font-black text-lg mt-2 italic flex items-center justify-center gap-2">
                                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                        Processing...
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function MainHomeFeed() {
    return (
        <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <MainHomeFeedContent />
        </Suspense>
    );
}
