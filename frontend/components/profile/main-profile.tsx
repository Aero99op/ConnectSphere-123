"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { StoryAvatar } from "@/components/ui/story-avatar";
import {
    Grid, Bookmark, LogOut, Loader2, ArrowLeft,
    AtSign, MapPin, Briefcase, Calendar, Info, Medal, Globe, Clapperboard, Play,
    Settings, User, Sparkles, X, MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PostCard } from "@/components/feed/post-card";
import { usePathname, useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getProfileByUsername, getUserStats } from "@/lib/actions/profile"; // 🔱 New Server Actions

// Utility function to determine border color based on role
function getRoleBorderColor(role: string) {
    if (role === 'official') return 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]';
    if (role === 'admin') return 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
    return 'border-orange-500 shadow-[0_0_15px_rgba(255,165,0,0.5)]'; // Citizen (Premium Saffron)
}

function ProfileHeaderSkeleton() {
    return (
        <div className="w-full relative bg-zinc-950/40 backdrop-blur-xl border-b border-white/5 pb-8 animate-pulse">
            <div className="h-32 md:h-48 w-full bg-zinc-900/50" />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row gap-6 items-start sm:items-end">
                    <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-zinc-800" />
                    <div className="flex-1 space-y-4 w-full pt-4 sm:pt-0">
                        <div className="h-8 bg-zinc-800 rounded w-1/3" />
                        <div className="h-4 bg-zinc-800 rounded w-1/4" />
                        <div className="flex gap-4">
                            <div className="h-10 bg-zinc-800 rounded w-24" />
                            <div className="h-10 bg-zinc-800 rounded w-24" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MainUserProfileContent() {
    const { user: authUser, supabase } = useAuth();
    const params = useParams();
    const router = useRouter();
    const username = params.username as string; // 🔱 Use username from params

    // Auth & Basic Info
    const [profile, setProfile] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Details tab
    const [activeTab, setActiveTab] = useState("posts");

    // Posts tab
    const [posts, setPosts] = useState<any[]>([]);
    const [quixList, setQuixList] = useState<any[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [loadingQuix, setLoadingQuix] = useState(false);

    // Follower Stats & State
    const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0, quix: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [followLoading, setFollowLoading] = useState(false);

    // Follower Lists State
    const [followersList, setFollowersList] = useState<any[]>([]);
    const [followingList, setFollowingList] = useState<any[]>([]);
    const [loadingFollowsList, setLoadingFollowsList] = useState(false);
    const [showEnlargedAvatar, setShowEnlargedAvatar] = useState(false);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!username) return;
            setLoading(true);

            // 🔱 1. Fetch Profile Data via SERVER ACTION (FIXES FINDING-001 & 002)
            const { data: profileData, error: profileError } = await getProfileByUsername(username);

            if (profileError || !profileData) {
                setLoading(false);
                return;
            }

            const currentUserId = profileData.id;
            setUserId(currentUserId);
            setProfile(profileData);

            // 🔱 2. Fetch Stats via SERVER ACTION
            setLoadingPosts(true);
            setCurrentUser(authUser);

            const [statsResponse, postsResponse, quixResponse] = await Promise.all([
                getUserStats(currentUserId),
                supabase.from('posts').select(`*, profiles(username, avatar_url, full_name, role)`).eq('user_id', currentUserId).order('created_at', { ascending: false }),
                supabase.from('quix').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false })
            ]);

            if (authUser) {
                const { data: followData } = await supabase
                    .from('follows')
                    .select('*')
                    .match({ follower_id: authUser.id, following_id: currentUserId })
                    .single();

                if (followData) setIsFollowing(true);
            }

            if (postsResponse.data) setPosts(postsResponse.data);
            if (quixResponse.data) setQuixList(quixResponse.data);
            if (statsResponse.data) {
                setStats(statsResponse.data);
            }

            setLoadingPosts(false);
            setLoading(false);
        };

        fetchUserProfile();
    }, [username, authUser, supabase]);

    const handleFollowToggle = async () => {
        if (!currentUser) {
            toast.error("Please login to follow users.");
            return;
        }

        setFollowLoading(true);
        try {
            if (isFollowing) {
                await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", userId);
                setIsFollowing(false);
                setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
                toast.success(`Unfollowed @${profile.username}`);
            } else {
                await supabase.from("follows").insert({ follower_id: currentUser.id, following_id: userId });
                setIsFollowing(true);
                setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
                toast.success(`Following @${profile.username}`);
            }
        } catch (error) {
            console.error("Follow action failed:", error);
            toast.error("Follow fail ho gaya, koshish kariye!");
        } finally {
            setFollowLoading(false);
        }
    };

    const handleMessageClick = async () => {
        if (!currentUser) {
            toast.error("Pehle login toh kar lo bhai!");
            return;
        }
        
        setFollowLoading(true);
        try {
            const { data: existing } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${currentUser.id})`)
                .maybeSingle();
                
            if (existing) {
                router.push(`/messages?convId=${existing.id}`);
            } else {
                const { data: newConv, error } = await supabase
                    .from('conversations')
                    .insert({ user1_id: currentUser.id, user2_id: profile.id })
                    .select('id')
                    .single();
                    
                if (error) throw error;
                if (newConv) router.push(`/messages?convId=${newConv.id}`);
            }
        } catch (err) {
            console.error("Message redirect failed", err);
            toast.error("Kuch gadbad hai, chat start nahi ho rahi.");
        } finally {
            setFollowLoading(false);
        }
    };

    const fetchFollowList = async (type: 'followers' | 'following') => {
        if (!userId) return;
        setActiveTab(type);
        setLoadingFollowsList(true);

        if (type === 'followers') {
            const { data } = await supabase
                .from('follows')
                .select(`
                    follower_id,
                    profiles!follows_follower_id_fkey(id, username, full_name, avatar_url, role)
                `)
                .eq('following_id', userId);

            setFollowersList(data?.map(d => d.profiles) || []);
        } else {
            const { data } = await supabase
                .from('follows')
                .select(`
                    following_id,
                    profiles!follows_following_id_fkey(id, username, full_name, avatar_url, role)
                `)
                .eq('follower_id', userId);

            setFollowingList(data?.map(d => d.profiles) || []);
        }

        setLoadingFollowsList(false);
    };

    const { theme } = useTheme();

    if (loading) return (
        <div className={cn("min-h-screen", theme === 'radiant-void' ? "bg-black" : "bg-[#050507]")}>
            <ProfileHeaderSkeleton />
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        </div>
    );

    if (!profile) return (
        <div className={cn("min-h-screen flex flex-col items-center justify-center p-6 text-center", theme === 'radiant-void' ? "bg-black" : "bg-[#050507]")}>
            <h1 className="text-4xl font-display font-black text-white uppercase tracking-widest mb-4">404_NOT_FOUND</h1>
            <p className="text-zinc-500 font-mono">This profile does not exist.</p>
            <Link href="/search">
                <Button className="mt-8 bg-primary text-black font-bold uppercase tracking-widest hover:bg-primary/90 rounded-full px-8">Go Back</Button>
            </Link>
        </div>
    );

    const isOfficial = profile.role === 'official';
    const isCitizen = profile.role === 'citizen';
    const profileBorderColor = getRoleBorderColor(profile.role);
    const joinDate = new Date(profile.updated_at || Date.now()).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return (
        <div className={cn(
            "min-h-screen text-white pb-20 md:pb-0 md:pl-20 xl:pl-64 transition-colors duration-500",
            theme === 'radiant-void' ? "bg-black" : "bg-[#050507]"
        )}>

            {/* Top Navigation Bar / App Bar */}
            <div className={cn(
                "sticky top-0 z-50 px-4 h-14 flex items-center justify-between xl:hidden",
                theme === 'radiant-void' ? "bg-black/40 backdrop-blur-xl border-b border-white/5" : "glass border-b border-white/5"
            )}>
                <div className="flex items-center gap-3">
                    <Link href="/search" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors active:scale-95">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <span className={cn(
                        "font-display font-black text-lg tracking-tighter truncate max-w-[200px]",
                        theme === 'radiant-void' ? "uppercase italic" : ""
                    )}>{profile.username}</span>
                </div>
            </div>

            {/* Profile Header Block */}
            <div className={cn(
                "w-full relative pb-8 overflow-hidden",
                theme === 'radiant-void' ? "bg-black border-b border-white/5" : "bg-zinc-950/40 backdrop-blur-xl border-b border-white/5"
            )}>

                {/* Cover Photo / Banner Area */}
                <div className={cn(
                    "h-32 sm:h-48 md:h-64 w-full relative",
                    theme === 'radiant-void' ? "bg-black" : "bg-gradient-to-br from-zinc-800 via-zinc-900 to-black"
                )}>
                    {theme === 'radiant-void' ? (
                        <>
                            {/* Cinematic Gradient for Radiant Void */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black to-accent/10 opacity-50" />
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
                            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
                        </>
                    ) : (
                        <>
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                        </>
                    )}
                    
                    {/* Settings Button in Top Right */}
                    {currentUser?.id === userId && (
                        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-30">
                            <button
                                onClick={() => router.push('/settings')}
                                className={cn(
                                    "p-2.5 border rounded-2xl transition-all active:scale-90 bg-black/40 backdrop-blur-md",
                                    theme === 'radiant-void' ? "border-primary/20 shadow-[0_0_15px_rgba(255,141,135,0.2)] text-primary hover:text-white" : "border-premium text-zinc-400 hover:text-white hover:bg-white/10 shadow-premium-sm"
                                )}
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative -mt-16 sm:-mt-20 md:-mt-24 flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-end">

                        {/* Profile Avatar */}
                        <div className="relative group shrink-0">
                            <div className={cn(
                                "absolute -inset-1 blur-md rounded-[32px] sm:rounded-[40px] opacity-70 transition-all duration-700",
                                theme === 'radiant-void' ? "bg-gradient-to-r from-primary via-accent to-secondary animate-pulse" : (isOfficial ? 'bg-blue-500' : 'bg-orange-500')
                            )} />
                            <StoryAvatar 
                                user={{ id: profile.id, username: profile.username, full_name: profile.full_name, avatar_url: profile.avatar_url }}
                                className={cn(
                                    "w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 border-4 object-cover bg-zinc-900 shadow-2xl relative z-10 transition-transform duration-500 hover:scale-105",
                                    theme === 'radiant-void' ? "rounded-xl border-black" : `rounded-[28px] sm:rounded-[36px] border-[#050507] ${profileBorderColor}`
                                )}
                                onClick={() => setShowEnlargedAvatar(true)}
                                onLongPress={() => setShowEnlargedAvatar(true)}
                            />
                        </div>

                        {/* Name & Actions */}
                        <div className="flex-1 w-full text-center sm:text-left pt-2 sm:pt-0 pb-2 flex flex-col sm:flex-row sm:justify-between items-center sm:items-end gap-6">
                            <div className="space-y-1.5 flex-1 min-w-0">
                                <h1 className={cn(
                                    "text-2xl sm:text-3xl md:text-4xl font-display font-black tracking-tight flex items-center justify-center sm:justify-start gap-2 truncate text-white",
                                    theme === 'radiant-void' ? "uppercase italic" : ""
                                )}>
                                    {profile.full_name || profile.username}
                                    {isOfficial && (
                                        <span className={cn(
                                            "text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0",
                                            theme === 'radiant-void' ? "bg-primary/10 text-primary border-primary/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                        )}>
                                            <Medal className="w-3 h-3" /> Official
                                        </span>
                                    )}
                                </h1>
                                <p className={cn(
                                    "font-mono text-xs sm:text-sm font-medium flex items-center justify-center sm:justify-start gap-1 truncate transition-colors",
                                    theme === 'radiant-void' ? "text-primary italic" : "text-zinc-400"
                                )}>
                                    <AtSign className="w-3.5 h-3.5" />
                                    {profile.username}
                                </p>
                            </div>

                            <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                                {currentUser?.id !== userId && (
                                    <div className="flex gap-1.5 sm:gap-2">
                                        <Button
                                            onClick={handleFollowToggle}
                                            disabled={followLoading}
                                            className={cn(
                                                "flex-1 sm:flex-none font-bold py-2 sm:py-3 px-6 sm:px-8 rounded-full transition-all active:scale-95 shadow-xl min-w-[120px] sm:min-w-[140px]",
                                                isFollowing 
                                                    ? "bg-zinc-800 text-white border border-white/10 hover:bg-zinc-900" 
                                                    : theme === 'radiant-void' 
                                                        ? "bg-white text-black hover:bg-zinc-200" 
                                                        : "bg-primary text-white hover:bg-primary/90"
                                            )}
                                        >
                                            {followLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isFollowing ? "Dosti Tod" : "Dost Ban"}
                                        </Button>

                                        <Button
                                            onClick={handleMessageClick}
                                            disabled={followLoading}
                                            className={cn(
                                                "w-12 h-12 p-0 rounded-full flex items-center justify-center transition-all bg-white/5 border border-white/10 hover:bg-white/10 active:scale-90",
                                                theme === 'radiant-void' ? "hover:border-primary/50 text-white" : "text-white"
                                            )}
                                            title="Bhejo ek Guptugu"
                                        >
                                            <MessageCircle className="w-5 h-5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bio & Details Area */}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">

                        {/* Left Col: Details */}
                        <div className="md:col-span-1 space-y-6">
                            {/* Bio */}
                            {profile.bio && (
                                <p className={cn(
                                    "text-sm leading-relaxed font-medium",
                                    theme === 'radiant-void' ? "text-zinc-300 italic font-serif" : "text-zinc-300"
                                )}>
                                    {profile.bio}
                                </p>
                            )}

                            {/* Meta Info */}
                            <div className={cn(
                                "space-y-3 pt-4 border-t",
                                theme === 'radiant-void' ? "border-white/5" : "border-white/5"
                            )}>
                                {profile.assigned_area && (
                                    <div className="flex items-center gap-3 text-zinc-400 text-sm">
                                        <MapPin className={cn("w-4 h-4 shrink-0", theme === 'radiant-void' ? "text-primary" : "text-primary")} />
                                        <span>{profile.assigned_area}</span>
                                    </div>
                                )}
                                {profile.department && (
                                    <div className="flex items-center gap-3 text-zinc-400 text-sm">
                                        <Briefcase className={cn("w-4 h-4 shrink-0", theme === 'radiant-void' ? "text-accent" : "text-blue-400")} />
                                        <span>{profile.department} Dept.</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-zinc-500 text-sm">
                                    <Calendar className="w-4 h-4 shrink-0" />
                                    <span>Joined {joinDate}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Col: Stats */}
                        <div className="md:col-span-2">
                            <div className={cn(
                                "flex gap-4 sm:gap-6 justify-between sm:justify-start glass p-4 border-premium md:w-fit transition-all duration-500",
                                theme === 'radiant-void' ? "bg-black/40 border-white/5 rounded-2xl" : "rounded-3xl"
                            )}>
                                <div onClick={() => setActiveTab('posts')} className="text-center sm:px-4 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors py-2 flex-1 sm:flex-none">
                                    <div className="font-display font-black text-2xl text-white">{stats.posts}</div>
                                    <div className={cn("text-[10px] font-mono font-black uppercase tracking-widest", theme === 'radiant-void' ? "text-primary" : "text-zinc-500")}>Posts</div>
                                </div>
                                <div className={cn("w-px my-2", theme === 'radiant-void' ? "bg-white/5" : "bg-white/10")} />
                                <div onClick={() => setActiveTab('quix')} className="text-center sm:px-4 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors py-2 flex-1 sm:flex-none">
                                    <div className="font-display font-black text-2xl text-white">{stats.quix}</div>
                                    <div className={cn("text-[10px] font-mono font-black uppercase tracking-widest", theme === 'radiant-void' ? "text-primary" : "text-zinc-500")}>Quix</div>
                                </div>
                                <div className={cn("w-px my-2", theme === 'radiant-void' ? "bg-white/5" : "bg-white/10")} />
                                <div onClick={() => fetchFollowList('followers')} className="text-center sm:px-4 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors py-2 flex-1 sm:flex-none">
                                    <div className="font-display font-black text-2xl text-white">{stats.followers}</div>
                                    <div className={cn("text-[10px] font-mono font-black uppercase tracking-widest", theme === 'radiant-void' ? "text-primary" : "text-zinc-500")}>Followers</div>
                                </div>
                                <div className={cn("w-px my-2", theme === 'radiant-void' ? "bg-white/5" : "bg-white/10")} />
                                <div onClick={() => fetchFollowList('following')} className="text-center sm:px-4 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors py-2 flex-1 sm:flex-none">
                                    <div className="font-display font-black text-2xl text-white">{stats.following}</div>
                                    <div className={cn("text-[10px] font-mono font-black uppercase tracking-widest", theme === 'radiant-void' ? "text-primary" : "text-zinc-500")}>Following</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Profile Content Tabs */}
            <div className="max-w-4xl mx-auto w-full px-0 sm:px-6 lg:px-8 mt-2 sm:mt-6 transition-all duration-500">

                {/* Custom Tab Navigation */}
                <div className={cn(
                    "flex w-full p-1.5 border-b sm:border z-40 relative group",
                    theme === 'radiant-void' 
                        ? "bg-black/20 backdrop-blur-md border-white/5 sm:rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
                        : "glass sm:rounded-full border-white/5 sm:shadow-lg sticky sm:static top-[56px]"
                )}>
                    {/* Sliding Indicator for Radiant Void could be added here */}
                    <button
                        onClick={() => setActiveTab("posts")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 transition-all duration-300",
                            activeTab === "posts" 
                                ? (theme === 'radiant-void' ? "bg-primary/20 text-white rounded-lg shadow-[0_0_15px_rgba(255,141,135,0.2)]" : "bg-white/10 text-white rounded-full shadow-sm") 
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full"
                            , "text-sm font-bold uppercase tracking-widest"
                        )}
                    >
                        <Grid className={cn("w-4 h-4", activeTab === "posts" && theme === 'radiant-void' ? "text-primary shadow-primary" : "")} /> 
                        <span className={theme === 'radiant-void' && activeTab === 'posts' ? "italic" : ""}>Posts</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("quix")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 transition-all duration-300",
                            activeTab === "quix" 
                                ? (theme === 'radiant-void' ? "bg-primary/20 text-white rounded-lg shadow-[0_0_15px_rgba(255,141,135,0.2)]" : "bg-white/10 text-white rounded-full shadow-sm") 
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full"
                            , "text-sm font-bold uppercase tracking-widest"
                        )}
                    >
                        <Clapperboard className={cn("w-4 h-4", activeTab === "quix" && theme === 'radiant-void' ? "text-primary shadow-primary" : "")} /> 
                        <span className={theme === 'radiant-void' && activeTab === 'quix' ? "italic" : ""}>Quix</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("about")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 transition-all duration-300",
                            activeTab === "about" 
                                ? (theme === 'radiant-void' ? "bg-primary/20 text-white rounded-lg shadow-[0_0_15px_rgba(255,141,135,0.2)]" : "bg-white/10 text-white rounded-full shadow-sm") 
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full"
                            , "text-sm font-bold uppercase tracking-widest"
                        )}
                    >
                        <Info className={cn("w-4 h-4", activeTab === "about" && theme === 'radiant-void' ? "text-primary shadow-primary" : "")} /> 
                        <span className={theme === 'radiant-void' && activeTab === 'about' ? "italic" : ""}>About</span>
                    </button>
                </div>

                {/* Tab Content Areas */}
                <div className="pb-12 px-4 sm:px-0 min-h-[50vh] mt-8">

                    {/* POSTS TAB */}
                    {activeTab === "posts" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loadingPosts ? (
                                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : posts.length > 0 ? (
                                <div className="flex flex-col gap-6 max-w-xl mx-auto w-full">
                                    {posts.map((post) => (
                                        <PostCard key={post.id} post={post} />
                                    ))}
                                </div>
                            ) : (
                                <div className={cn(
                                    "p-16 rounded-[2.5rem] text-center border-dashed opacity-60 max-w-xl mx-auto",
                                    theme === 'radiant-void' ? "bg-zinc-900/10 border-white/5" : "glass-panel border-premium"
                                )}>
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                        <Grid className="w-8 h-8 text-zinc-600" />
                                    </div>
                                    <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500">No Posts Yet</h3>
                                    <p className="text-sm font-mono text-zinc-700 mt-2 uppercase tracking-widest">No content shared yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* QUIX TAB */}
                    {activeTab === "quix" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loadingPosts ? (
                                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : quixList.length > 0 ? (
                                <div className="grid grid-cols-3 gap-1 sm:gap-4 max-w-4xl mx-auto w-full">
                                    {quixList.map((quix) => (
                                        <Link
                                            key={quix.id}
                                            href={`/quix?id=${quix.id}`}
                                            className={cn(
                                                "aspect-[9/16] relative group overflow-hidden border border-white/5 bg-zinc-900 transition-all duration-500",
                                                theme === 'radiant-void' ? "rounded-lg" : "rounded-xl sm:rounded-2xl"
                                            )}
                                        >
                                            <img
                                                src={quix.thumbnail_url || quix.video_url?.replace(/\.[^/.]+$/, ".jpg")}
                                                alt=""
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                <Play className={cn("w-8 h-8 fill-current", theme === 'radiant-void' ? "text-primary" : "text-white")} />
                                            </div>
                                            <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-[10px] sm:text-xs font-bold drop-shadow-lg">
                                                <Play className="w-3 h-3 fill-current" />
                                                {quix.views_count || 0}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className={cn(
                                    "p-16 rounded-[2.5rem] text-center border-dashed opacity-60 max-w-xl mx-auto",
                                    theme === 'radiant-void' ? "bg-zinc-900/10 border-white/5" : "glass-panel border-premium"
                                )}>
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                        <Clapperboard className="w-8 h-8 text-zinc-600" />
                                    </div>
                                    <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500">No Quix Yet</h3>
                                    <p className="text-sm font-mono text-zinc-700 mt-2 uppercase tracking-widest">No reels created yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ABOUT TAB */}
                    {activeTab === "about" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto space-y-6">

                            <div className={cn(
                                "p-6 sm:p-8 border shadow-premium-sm space-y-8",
                                theme === 'radiant-void' ? "bg-black/20 border-white/5 rounded-2xl" : "glass rounded-[2rem] border-premium"
                            )}>
                                <div>
                                    <h3 className={cn(
                                        "text-[11px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2",
                                        theme === 'radiant-void' ? "text-primary" : "text-zinc-500"
                                    )}>
                                        <User className="w-3.5 h-3.5" /> Identity Info
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Full legal name</p>
                                            <p className={cn(
                                                "font-medium text-lg",
                                                theme === 'radiant-void' ? "text-white uppercase italic" : "text-white"
                                            )}>{profile.full_name || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">System Handle</p>
                                            <p className={cn(
                                                "font-mono",
                                                theme === 'radiant-void' ? "text-primary italic" : "text-zinc-300"
                                            )}>@{profile.username}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Clearance Level</p>
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm capitalize font-medium",
                                                theme === 'radiant-void' ? "bg-white/5 border-primary/20" : "bg-white/5 border-white/10"
                                            )}>
                                                <div className={`w-2 h-2 rounded-full ${isOfficial ? 'bg-blue-500' : isCitizen ? 'bg-orange-500' : (theme === 'radiant-void' ? 'bg-primary shadow-[0_0_10px_rgba(255,141,135,0.8)]' : 'bg-red-500')}`} />
                                                {profile.role || "Citizen"}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isOfficial && profile.department && (
                                    <div>
                                        <h3 className={cn(
                                            "text-[11px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2",
                                            theme === 'radiant-void' ? "text-accent" : "text-blue-500"
                                        )}>
                                            <Briefcase className="w-3.5 h-3.5" /> Official Duties
                                        </h3>
                                        <div className={cn(
                                            "p-5 rounded-2xl flex flex-col gap-3",
                                            theme === 'radiant-void' ? "bg-white/5 border border-white/5" : "glass-card bg-blue-500/5 border-blue-500/10"
                                        )}>
                                            <div className="flex justify-between items-start">
                                                <span className="text-zinc-400 text-sm">Department</span>
                                                <span className="text-white font-bold">{profile.department}</span>
                                            </div>
                                            {profile.assigned_area && (
                                                <div className="flex justify-between items-start">
                                                    <span className="text-zinc-400 text-sm">Jurisdiction</span>
                                                    <span className="text-white font-bold">{profile.assigned_area}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}

                    {/* FOLLOWERS / FOLLOWING TABS */}
                    {(activeTab === "followers" || activeTab === "following") && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto space-y-4">
                            <h2 className={cn(
                                "text-xl font-display font-black text-white mb-6 uppercase tracking-widest flex items-center gap-2",
                                theme === 'radiant-void' ? "italic" : ""
                            )}>
                                <User className={cn("w-5 h-5", theme === 'radiant-void' ? "text-primary" : "text-primary")} /> {activeTab === "followers" ? 'Followers' : 'Following'}
                            </h2>
                            {loadingFollowsList ? (
                                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : (activeTab === "followers" ? followersList : followingList).length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {(activeTab === "followers" ? followersList : followingList).map((user: any) => (
                                        <Link
                                            key={user.id}
                                            href={`/profile/${user.username}`}
                                            className="group relative"
                                        >
                                            <div className={cn(
                                                "absolute -inset-0.5 blur opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl",
                                                theme === 'radiant-void' ? "bg-gradient-to-r from-primary/40 to-accent/40" : "bg-gradient-to-br from-primary/20 to-secondary/20"
                                            )} />
                                            <div className={cn(
                                                "relative p-4 flex items-center gap-4 hover:translate-x-1 transition-all",
                                                theme === 'radiant-void' ? "bg-black border border-white/5 rounded-xl" : "glass-card border-premium rounded-[1.5rem]"
                                            )}>
                                                <StoryAvatar 
                                                    user={{ id: user.id, username: user.username, full_name: user.full_name, avatar_url: user.avatar_url }}
                                                    className={cn(
                                                        "w-12 h-12 border-2 object-cover",
                                                        theme === 'radiant-void' ? "rounded-lg border-primary/20" : `rounded-2xl border-zinc-900 ring-1 ring-white/10 ${getRoleBorderColor(user.role)}`
                                                    )}
                                                />
                                                <div className="min-w-0">
                                                    <p className={cn(
                                                        "font-display font-black text-lg tracking-tighter group-hover:text-primary transition-colors truncate",
                                                        theme === 'radiant-void' ? "uppercase italic" : ""
                                                    )}>
                                                        {user.full_name || user.username}
                                                    </p>
                                                    <p className={cn(
                                                        "text-[10px] font-mono font-black uppercase tracking-widest truncate",
                                                        theme === 'radiant-void' ? "text-primary/70" : "text-zinc-500"
                                                    )}>
                                                        @{user.username}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className={cn(
                                    "p-16 rounded-[2.5rem] text-center border-dashed opacity-60",
                                    theme === 'radiant-void' ? "bg-zinc-900/10 border-white/5" : "glass-panel border-premium"
                                )}>
                                    <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500 italic">404_NOT_FOUND</h3>
                                    <p className="text-sm font-mono text-zinc-700 mt-2 uppercase tracking-widest">
                                        {activeTab === "followers" ? 'No followers yet.' : 'Not following anyone yet.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Enlarged Avatar Modal */}
            <AnimatePresence>
                {showEnlargedAvatar && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-10"
                        onClick={() => setShowEnlargedAvatar(false)}
                    >
                        {/* Close Button Desktop */}
                        <button 
                            className="absolute top-6 right-6 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all hidden sm:block"
                            onClick={(e) => { e.stopPropagation(); setShowEnlargedAvatar(false); }}
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
                        
                        {/* Mobile Swipe Indicator (Bottom since we swipe UP to close) */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 sm:hidden opacity-50">
                            <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Swipe up to close</span>
                            <div className="w-8 h-1 bg-white/20 rounded-full animate-bounce" />
                        </div>

                        <motion.img 
                            src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`}
                            alt={profile.username}
                            initial={{ scale: 0.8, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 50 }}
                            className="max-w-full max-h-[70vh] sm:max-h-[85vh] rounded-3xl object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
                            onClick={(e) => e.stopPropagation()}
                            drag="y"
                            dragConstraints={{ top: -200, bottom: 0 }}
                            onDragEnd={(e, info) => {
                                if (info.offset.y < -100) { // Swipe up
                                    setShowEnlargedAvatar(false);
                                }
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function MainUserProfile() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050507]"><ProfileHeaderSkeleton /><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></div>}>
            <MainUserProfileContent />
        </Suspense>
    );
}
