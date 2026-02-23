"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Grid, Bookmark, LogOut, Loader2, ArrowLeft,
    AtSign, MapPin, Briefcase, Calendar, Info, Medal, Globe
} from "lucide-react";
import Link from "next/link";
import { PostCard } from "@/components/feed/post-card";
import { usePathname, useParams } from "next/navigation";

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

function AnotherUserProfileContent() {
    const params = useParams();
    const userId = params.id as string;

    // Auth & Basic Info
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Details tab
    const [activeTab, setActiveTab] = useState("posts");

    // Posts tab
    const [posts, setPosts] = useState<any[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);

    // Follower Stats & State
    const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [followLoading, setFollowLoading] = useState(false);

    // Follower Lists State
    const [followersList, setFollowersList] = useState<any[]>([]);
    const [followingList, setFollowingList] = useState<any[]>([]);
    const [loadingFollowsList, setLoadingFollowsList] = useState(false);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!userId) return;
            setLoading(true);

            // 1. Fetch Profile Data
            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (profileError || !profileData) {
                setLoading(false);
                return;
            }

            setProfile(profileData);

            // 2. Fetch Stats, Posts & Current User Auth
            setLoadingPosts(true);

            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            const [postsResponse, followersResponse, followingResponse] = await Promise.all([
                supabase.from('posts').select(`*, profiles(username, avatar_url, full_name, role)`).eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
            ]);

            if (user) {
                // Check if already following
                const { data: followData } = await supabase
                    .from('follows')
                    .select('*')
                    .match({ follower_id: user.id, following_id: userId })
                    .single();

                if (followData) setIsFollowing(true);
            }

            if (postsResponse.data) setPosts(postsResponse.data);

            setStats({
                posts: postsResponse.data?.length || 0,
                followers: followersResponse.count || 0,
                following: followingResponse.count || 0
            });

            setLoadingPosts(false);
            setLoading(false);
        };

        fetchUserProfile();
    }, [userId]);

    const handleFollowToggle = async () => {
        if (!currentUser) {
            alert("Please login first to follow!");
            return;
        }

        setFollowLoading(true);

        if (isFollowing) {
            // Unfollow
            const { error } = await supabase
                .from('follows')
                .delete()
                .match({ follower_id: currentUser.id, following_id: userId });

            if (!error) {
                setIsFollowing(false);
                setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }));
            }
        } else {
            // Follow
            const { error } = await supabase
                .from('follows')
                .insert({ follower_id: currentUser.id, following_id: userId });

            if (!error) {
                setIsFollowing(true);
                setStats(s => ({ ...s, followers: s.followers + 1 }));
            }
        }
        setFollowLoading(false);
    };

    const fetchFollowList = async (type: 'followers' | 'following') => {
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

    if (loading) return (
        <div className="min-h-screen bg-[#050507]">
            <ProfileHeaderSkeleton />
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 text-center">
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
    const joinDate = new Date(profile.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-[#050507] text-white pb-20 md:pb-0 md:pl-20 xl:pl-64">

            {/* Top Navigation Bar / App Bar */}
            <div className="sticky top-0 z-50 glass border-b border-white/5 px-4 h-14 flex items-center justify-between xl:hidden">
                <div className="flex items-center gap-3">
                    <Link href="/search" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors active:scale-95">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <span className="font-display font-black text-lg tracking-tighter truncate max-w-[200px]">{profile.username}</span>
                </div>
            </div>

            {/* Profile Header Block */}
            <div className="w-full relative bg-zinc-950/40 backdrop-blur-xl border-b border-white/5 pb-8 overflow-hidden">

                {/* Cover Photo / Banner Area */}
                <div className="h-32 sm:h-48 md:h-64 w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black relative">
                    {/* Placeholder abstract pattern for cover */}
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative -mt-16 sm:-mt-20 md:-mt-24 flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-end">

                        {/* Profile Avatar */}
                        <div className="relative group shrink-0">
                            <div className={`absolute -inset-1 blur-md rounded-[32px] sm:rounded-[40px] opacity-70 ${isOfficial ? 'bg-blue-500' : 'bg-orange-500'}`} />
                            <Avatar className={`w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-[28px] sm:rounded-[36px] border-4 border-[#050507] object-cover bg-zinc-900 shadow-2xl relative z-10 ${profileBorderColor}`}>
                                <AvatarImage src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} className="object-cover" />
                                <AvatarFallback className="text-4xl sm:text-5xl font-display font-black text-zinc-600 bg-zinc-900">
                                    {profile.username?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </div>

                        {/* Name & Actions */}
                        <div className="flex-1 w-full text-center sm:text-left pt-2 sm:pt-0 pb-2 flex flex-col sm:flex-row sm:justify-between items-center sm:items-end gap-6">
                            <div className="space-y-1.5 flex-1 min-w-0">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-black tracking-tight flex items-center justify-center sm:justify-start gap-2 truncate text-white">
                                    {profile.full_name || profile.username}
                                    {isOfficial && (
                                        <span className="bg-blue-500/10 text-blue-400 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1 shrink-0">
                                            <Medal className="w-3 h-3" /> Official
                                        </span>
                                    )}
                                </h1>
                                <p className="text-zinc-400 font-mono text-xs sm:text-sm font-medium flex items-center justify-center sm:justify-start gap-1 truncate">
                                    <AtSign className="w-3.5 h-3.5" />
                                    {profile.username}
                                </p>
                            </div>

                            <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                                {currentUser?.id !== userId && (
                                    <Button
                                        onClick={handleFollowToggle}
                                        disabled={followLoading}
                                        className={`flex-1 sm:flex-none uppercase font-bold tracking-widest h-11 px-8 rounded-full transition-all active:scale-95 ${isFollowing
                                            ? 'bg-zinc-800 text-white hover:bg-zinc-700 border border-white/10'
                                            : 'bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(255,165,0,0.3)]'
                                            }`}
                                    >
                                        {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? 'Unfollow' : 'Follow'}
                                    </Button>
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
                                <p className="text-zinc-300 text-sm leading-relaxed font-medium">
                                    {profile.bio}
                                </p>
                            )}

                            {/* Meta Info */}
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                {profile.assigned_area && (
                                    <div className="flex items-center gap-3 text-zinc-400 text-sm">
                                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                                        <span>{profile.assigned_area}</span>
                                    </div>
                                )}
                                {profile.department && (
                                    <div className="flex items-center gap-3 text-zinc-400 text-sm">
                                        <Briefcase className="w-4 h-4 text-blue-400 shrink-0" />
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
                            <div className="flex gap-4 sm:gap-6 justify-between sm:justify-start glass p-4 rounded-3xl border-premium md:w-fit">
                                <div onClick={() => setActiveTab('posts')} className="text-center sm:px-4 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors py-2 flex-1 sm:flex-none">
                                    <div className="font-display font-black text-2xl text-white">{stats.posts}</div>
                                    <div className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Posts</div>
                                </div>
                                <div className="w-px bg-white/10 my-2" />
                                <div onClick={() => fetchFollowList('followers')} className="text-center sm:px-4 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors py-2 flex-1 sm:flex-none">
                                    <div className="font-display font-black text-2xl text-white">{stats.followers}</div>
                                    <div className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Followers</div>
                                </div>
                                <div className="w-px bg-white/10 my-2" />
                                <div onClick={() => fetchFollowList('following')} className="text-center sm:px-4 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors py-2 flex-1 sm:flex-none">
                                    <div className="font-display font-black text-2xl text-white">{stats.following}</div>
                                    <div className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Following</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Content Tabs */}
            <div className="max-w-4xl mx-auto w-full px-0 sm:px-6 lg:px-8 mt-2 sm:mt-6">

                {/* Custom Tab Navigation */}
                <div className="flex w-full glass sm:rounded-full p-1.5 border-b sm:border border-white/5 sm:shadow-lg mb-6 sticky sm:static top-[56px] z-40">
                    <button
                        onClick={() => setActiveTab("posts")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 rounded-full text-sm font-bold uppercase tracking-widest transition-all ${activeTab === "posts" ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                    >
                        <Grid className="w-4 h-4" /> Posts
                    </button>
                    <button
                        onClick={() => setActiveTab("about")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 rounded-full text-sm font-bold uppercase tracking-widest transition-all ${activeTab === "about" ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                    >
                        <Info className="w-4 h-4" /> About
                    </button>
                </div>

                {/* Tab Content Areas */}
                <div className="pb-12 px-4 sm:px-0 min-h-[50vh]">

                    {/* POSTS TAB */}
                    {activeTab === "posts" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loadingPosts ? (
                                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : posts.length > 0 ? (
                                <div className="flex flex-col gap-4 max-w-xl mx-auto w-full">
                                    {posts.map((post) => (
                                        <PostCard key={post.id} post={post} />
                                    ))}
                                </div>
                            ) : (
                                <div className="glass-panel p-16 rounded-[2.5rem] text-center border-premium border-dashed opacity-60 max-w-xl mx-auto">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                        <Grid className="w-8 h-8 text-zinc-600" />
                                    </div>
                                    <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500">No Posts Yet</h3>
                                    <p className="text-sm font-mono text-zinc-700 mt-2 uppercase tracking-widest">No content shared yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ABOUT TAB */}
                    {activeTab === "about" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto space-y-6">

                            <div className="glass p-6 sm:p-8 rounded-[2rem] border-premium shadow-premium-sm space-y-8">
                                <div>
                                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <User className="w-3.5 h-3.5" /> Identity Info
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Full legal name</p>
                                            <p className="text-white font-medium text-lg">{profile.full_name || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">System Handle</p>
                                            <p className="text-zinc-300 font-mono">@{profile.username}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Clearance Level</p>
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm capitalize font-medium">
                                                <div className={`w-2 h-2 rounded-full ${isOfficial ? 'bg-blue-500' : isCitizen ? 'bg-orange-500' : 'bg-red-500'}`} />
                                                {profile.role || "Citizen"}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isOfficial && profile.department && (
                                    <div>
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <Briefcase className="w-3.5 h-3.5" /> Official Duties
                                        </h3>
                                        <div className="glass-card bg-blue-500/5 border-blue-500/10 p-5 rounded-2xl flex flex-col gap-3">
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
                            <h2 className="text-xl font-display font-black text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                                <User className="w-5 h-5 text-primary" /> {activeTab === "followers" ? 'Followers' : 'Following'}
                            </h2>
                            {loadingFollowsList ? (
                                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : (activeTab === "followers" ? followersList : followingList).length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {(activeTab === "followers" ? followersList : followingList).map((user: any) => (
                                        <Link
                                            key={user.id}
                                            href={`/profile/${user.id}`}
                                            className="group relative"
                                        >
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
                                            <div className="relative glass-card border-premium p-4 rounded-[1.5rem] flex items-center gap-4 hover:translate-x-1 transition-all">
                                                <Avatar className={`w-12 h-12 border-2 border-zinc-900 ring-1 ring-white/10 ${getRoleBorderColor(user.role)}`}>
                                                    <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="object-cover" />
                                                    <AvatarFallback className="bg-zinc-800 text-primary font-display font-black">{user.full_name?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-display font-black text-white text-lg tracking-tighter group-hover:text-primary transition-colors truncate">
                                                        {user.full_name || user.username}
                                                    </p>
                                                    <p className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest truncate">
                                                        @{user.username}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="glass-panel p-16 rounded-[2.5rem] text-center border-premium border-dashed opacity-60">
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
        </div>
    );
}

// Need to import User separately since it wasn't in earlier list
import { User } from "lucide-react";

export default function AnotherUserProfile() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050507]"><ProfileHeaderSkeleton /><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></div>}>
            <AnotherUserProfileContent />
        </Suspense>
    );
}
