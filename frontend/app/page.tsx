"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { PostCard } from "@/components/feed/post-card";
import { Loader2, Bell, MessageCircle, AlertTriangle, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { StoryViewer } from "@/components/feed/story-viewer";
import { DepartmentDashboard } from "@/components/dashboard/department-dashboard";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileUpload } from "@/components/ui/file-upload";

function HomeFeedContent() {
    const [posts, setPosts] = useState<any[]>([]);
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(true);
    const [viewingStoryIndex, setViewingStoryIndex] = useState<number | null>(null);
    const [isAddingStory, setIsAddingStory] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);

    const [role, setRole] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'feed' | 'department'>('feed');
    const searchParams = useSearchParams();
    const router = useRouter();

    const fetchStories = async (currentUserId: string | null) => {
        // Fetch stories that haven't expired
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
        if (formattedStories.length === 0) {
            formattedStories = [
                { id: 'mock-2', username: 'Riya', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Riya', file_urls: ["https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80"], caption: "Selfie time! 📸" },
                { id: 'mock-3', username: 'Amit', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amit', file_urls: ["https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"], caption: "Nature is healing 🌿" }
            ];
        }

        setStories([myAddStoryCard, ...formattedStories]);
    };

    const fetchPosts = async () => {
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
        }

        if (formattedPosts.length === 0) {
            formattedPosts = [
                {
                    id: "dummy-1",
                    user_id: "system-1",
                    username: "ConnectSphere Official",
                    avatar_url: "/logo.svg",
                    caption: "Welcome to ConnectSphere! 🇮🇳\nThis is India's Premiere Social Media platform. Keep in touch with your community, share stories, and report civic issues directly to the authorities.",
                    file_urls: ["https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=800&q=80"],
                    thumbnail_url: "",
                    media_type: "image",
                    likes_count: 5420,
                    profiles: { full_name: "Team ConnectSphere" }
                },
                {
                    id: "dummy-2",
                    user_id: "system-2",
                    username: "Rahul Kumar",
                    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul",
                    caption: "Just used the new 'Civic Reports' feature to complain about the massive pothole near Brigade Road. The interface is super clean and it even auto-detected my location! 🛣️📍 Hope the BMC fixes it soon.",
                    file_urls: ["https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&q=80"],
                    thumbnail_url: "",
                    media_type: "image",
                    likes_count: 850,
                    profiles: { full_name: "Rahul Kumar" }
                },
                {
                    id: "dummy-3",
                    user_id: "system-3",
                    username: "Priya Sharma",
                    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
                    caption: "Beautiful sunset at Marine Drive today! 🌅 The vibes here are just unmatched. Who else is enjoying the weekend?",
                    file_urls: ["https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&q=80"],
                    thumbnail_url: "",
                    media_type: "image",
                    likes_count: 1205,
                    profiles: { full_name: "Priya Sharma" }
                }
            ];
        }

        setPosts(formattedPosts);
        setLoading(false);
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            let finalMode: 'feed' | 'department' = 'feed';

            if (user) {
                setUserId(user.id);
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
                setUserProfile(data);
                const userRole = data?.role || 'citizen';
                setRole(userRole);

                // Default logic
                finalMode = userRole === 'official' ? 'department' : 'feed';

                // Check saved preference
                try {
                    const savedMode = localStorage.getItem('connectsphere_mode');
                    if (savedMode === 'feed' || savedMode === 'department') {
                        finalMode = savedMode;
                    }
                } catch (e) { }

                // URL Params override everything
                const modeParam = searchParams.get('mode');
                if (modeParam === 'department') {
                    if (userRole === 'official') {
                        finalMode = 'department';
                        try { localStorage.setItem('connectsphere_mode', 'department'); } catch (e) { }
                    } else {
                        finalMode = 'feed';
                    }
                } else if (modeParam === 'feed') {
                    finalMode = 'feed';
                    try { localStorage.setItem('connectsphere_mode', 'feed'); } catch (e) { }
                }

                if (finalMode === 'department' && userRole !== 'official') {
                    finalMode = 'feed';
                }

            } else {
                finalMode = 'feed';
            }

            setViewMode(finalMode);

            if (finalMode === 'feed') {
                await Promise.all([fetchPosts(), fetchStories(user?.id || null)]);

                // Realtime Listeners 
                const channel = supabase
                    .channel('feed-updates')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
                        console.log("New post added! Updating feed...");
                        fetchPosts();
                    })
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => {
                        console.log("New story added! Updating rail...");
                        fetchStories(user?.id || null);
                    })
                    .subscribe();
            } else {
                setLoading(false);
            }

            setIsInitializing(false);
        };

        init();

        // Return a cleanup function for the component
        return () => {
            supabase.removeAllChannels();
        };
    }, [searchParams, role]);


    const [storyFileUrls, setStoryFileUrls] = useState<string[]>([]);
    const [storyThumbnailUrl, setStoryThumbnailUrl] = useState<string | undefined>();

    const handleStoryUploadComplete = async (urls: string[], thumbnailUrl?: string) => {
        if (!userId || urls.length === 0) return;
        setStoryFileUrls(urls);
        if (thumbnailUrl) setStoryThumbnailUrl(thumbnailUrl);

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


    if (isInitializing) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (viewMode === 'department') {
        return (
            <div className="fixed inset-0 z-[100] w-screen h-screen overflow-y-auto bg-black text-white">
                <DepartmentDashboard onSwitchMode={() => {
                    setViewMode('feed');
                    router.push('/?mode=feed');
                }} />
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-center w-full min-h-screen relative p-0 sm:p-4 md:p-6 lg:p-8 xl:px-0">
                {/* Premium Deep Background */}
                <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] opacity-50" />
                    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] opacity-30" />
                </div>

                {/* Feed Container (Center) */}
                <div className="w-full max-w-xl py-4 md:py-8 flex flex-col gap-6 z-10 mx-auto px-4 md:px-0">
                    {/* Top Header for Feed */}
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-display font-black text-gradient tracking-tightest">
                            ConnectSphere
                        </h1>
                        <div className="flex items-center gap-3">
                            <Link href="/notifications" className="relative p-2.5 rounded-2xl glass border-premium hover:bg-white/10 transition-all group active:scale-95 shadow-premium-sm">
                                <Bell className="w-6 h-6 text-zinc-400 group-hover:text-primary group-hover:scale-110 transition-all" />
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary border-2 border-black rounded-full animate-pulse shadow-[0_0_10px_rgba(255,165,0,0.5)]" />
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
                                        "relative p-[2.5px] rounded-[22px] transition-all duration-500",
                                        story.isAddButton
                                            ? "bg-zinc-800 border-premium shadow-premium-sm"
                                            : "bg-gradient-to-tr from-[#f09433] via-[#bc1888] to-[#962fbf] shadow-premium-lg group-hover:scale-105 group-hover:shadow-primary/20"
                                    )}>
                                        <div className="bg-[#050507] p-[2.5px] rounded-[20px]">
                                            <Avatar className="w-[64px] h-[64px] border-0 rounded-[18px] ring-1 ring-white/5">
                                                <AvatarImage src={story.avatar_url} className="object-cover rounded-[18px]" />
                                                <AvatarFallback className="bg-zinc-900 text-zinc-500 font-display font-bold">{story.username[0]}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        {story.isAddButton && (
                                            <div className="absolute -bottom-1 -right-1 bg-primary text-black rounded-full p-1 border-[3px] border-[#050507] shadow-xl group-hover:scale-110 transition-transform">
                                                <Plus className="w-3.5 h-3.5 font-bold" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[11px] font-display font-black text-zinc-500 group-hover:text-white transition-colors tracking-tight uppercase">
                                        {story.username === 'Your Story' ? 'My Story' : story.username}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Posts Feed */}
                    <div className="flex flex-col gap-4">
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
                    initialStoryIndex={viewingStoryIndex}
                    stories={stories.filter(s => !s.isAddButton)} // Pass only real stories to viewer
                    onClose={() => setViewingStoryIndex(null)}
                />
            )}

            {/* Add Story Upload Modal */}
            {isAddingStory && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-[32px] p-6 relative shadow-2xl">
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

export default function HomeFeed() {
    return (
        <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-black"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}>
            <HomeFeedContent />
        </Suspense>
    );
}
