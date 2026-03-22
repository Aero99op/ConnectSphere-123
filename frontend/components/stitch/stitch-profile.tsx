"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { getProfileByUsername, getUserStats } from "@/lib/actions/profile";

export function StitchProfileContent() {
    const { user: authUser, supabase } = useAuth();
    const params = useParams();
    const router = useRouter();
    const username = params.username as string;

    const [profile, setProfile] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState("posts");
    const [posts, setPosts] = useState<any[]>([]);
    const [quixList, setQuixList] = useState<any[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);

    const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0, quix: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [followLoading, setFollowLoading] = useState(false);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!username) return;
            setLoading(true);

            const { data: profileData, error: profileError } = await getProfileByUsername(username);

            if (profileError || !profileData) {
                setLoading(false);
                return;
            }

            const currentUserId = profileData.id;
            setUserId(currentUserId);
            setProfile(profileData);

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
            if (statsResponse.data) setStats(statsResponse.data);

            setLoadingPosts(false);
            setLoading(false);
        };

        fetchUserProfile();
    }, [username, authUser, supabase]);

    if (loading) return (
        <div className="min-h-screen bg-[#0c0e12] flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" />
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen bg-[#0c0e12] flex flex-col items-center justify-center p-6 text-center text-[#f8f9fe]">
            <h1 className="text-4xl font-black uppercase tracking-widest mb-4 font-headline">404_NOT_FOUND</h1>
            <p className="text-slate-500 font-mono">This profile does not exist.</p>
            <Link href="/search">
                <button className="mt-8 bg-[#ba9eff] text-black font-bold uppercase tracking-widest hover:bg-[#ba9eff]/90 rounded-full px-8 py-3">Go Back</button>
            </Link>
        </div>
    );

    return (
        <div className="bg-[#0c0e12] text-[#f8f9fe] font-body selection:bg-[#ba9eff]/30 min-h-screen">
            <style dangerouslySetInnerHTML={{ __html: `
                .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); }
                .glow-primary { box-shadow: 0 0 40px rgba(139, 92, 246, 0.15); }
                .font-headline { font-family: 'Plus Jakarta Sans', sans-serif; }
                body { background-color: #0c0e12; }
            `}} />

            {/* SideNavBar (Authority Source) */}
            <nav className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-950 border-r border-white/10 hidden md:flex flex-col py-8 px-4 gap-2">
                <div className="mb-10 px-4">
                    <h1 className="text-xl font-black text-violet-500 font-headline tracking-tighter">Connect</h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">Elite Network</p>
                </div>
                <div className="space-y-1">
                    <Link href="/" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                        <span className="font-medium text-sm">Home</span>
                    </Link>
                    <Link href="/search" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <span className="font-medium text-sm">Search</span>
                    </Link>
                    <Link href="/quix" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className="font-medium text-sm">Quix</span>
                    </Link>
                    <Link href="/create" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="font-medium text-sm">Create</span>
                    </Link>
                    <Link href="/report" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="font-medium text-sm">Report</span>
                    </Link>
                    <Link href={`/profile/${authUser?.id}`} className={`flex items-center gap-3 font-bold px-4 py-3 duration-300 ${currentUser?.id === userId ? 'text-violet-400 bg-white/5 rounded-lg translate-x-1' : 'text-slate-400 hover:bg-white/10 hover:text-violet-200 rounded-lg hover:translate-x-1'}`}>
                        <svg className="w-5 h-5 flex-shrink-0" fill={currentUser?.id === userId ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={currentUser?.id === userId ? 0 : 2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="font-medium text-sm">Profile</span>
                    </Link>
                </div>
            </nav>

            {/* Navigation Shell Mobile */}
            <div className="md:hidden fixed bottom-0 w-full h-16 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4 z-50">
                <Link href="/" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></Link>
                <Link href="/search" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></Link>
                <Link href="/create" className="w-10 h-10 bg-gradient-to-tr from-[#ba9eff] to-[#53ddfc] rounded-full flex items-center justify-center text-black shadow-lg shadow-[#ba9eff]/30 scale-110"><svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></Link>
                <Link href="/quix" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></Link>
                <Link href="/report" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg></Link>
                <Link href={`/profile/${authUser?.id}`} className="text-[#53ddfc] scale-105 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></Link>
            </div>

            {/* Main Content Canvas */}
            <main className="md:ml-64 min-h-screen bg-[#0c0e12] selection:text-white pb-20 md:pb-0">
                {/* Profile Header Section */}
                <header className="relative pt-12 pb-8 px-6 lg:px-12 max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
                        {/* Large Circular DP */}
                        <div className="relative group shrink-0">
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#ba9eff] to-[#53ddfc] rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-full p-[2px] bg-white/10">
                                <img src={profile.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-full h-full rounded-full object-cover border-4 border-[#0c0e12]" />
                            </div>
                        </div>

                        {/* User Details */}
                        <div className="flex-1 space-y-6 text-center md:text-left w-full">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <h2 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight text-[#f8f9fe]">{profile.username}</h2>
                                <div className="flex items-center justify-center md:justify-start gap-3">
                                    {currentUser?.id === userId ? (
                                        <>
                                            <Link href="/settings">
                                                <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-full font-semibold text-sm hover:bg-white/10 transition-colors">Edit Profile</button>
                                            </Link>
                                            <Link href="/settings">
                                                <button className="p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors">
                                                    <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                </button>
                                            </Link>
                                        </>
                                    ) : (
                                        <button className="px-6 py-2 bg-[#ba9eff] text-black border border-white/10 rounded-full font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform" disabled={followLoading} onClick={() => {}}>
                                            {isFollowing ? 'Unfollow' : 'Follow'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Stats Row */}
                            <div className="flex items-center justify-center md:justify-start gap-6 lg:gap-8 border-y border-white/5 py-4 flex-wrap">
                                <div className="flex gap-1.5 items-baseline">
                                    <span className="text-lg font-bold font-headline">{stats.posts}</span>
                                    <span className="text-sm text-[#a9abb0] font-medium">Posts</span>
                                </div>
                                <div className="flex gap-1.5 items-baseline">
                                    <span className="text-lg font-bold font-headline">{stats.quix}</span>
                                    <span className="text-sm text-[#a9abb0] font-medium">Quix</span>
                                </div>
                                <div className="flex gap-1.5 items-baseline">
                                    <span className="text-lg font-bold font-headline">{stats.followers}</span>
                                    <span className="text-sm text-[#a9abb0] font-medium">Followers</span>
                                </div>
                                <div className="flex gap-1.5 items-baseline">
                                    <span className="text-lg font-bold font-headline">{stats.following}</span>
                                    <span className="text-sm text-[#a9abb0] font-medium">Following</span>
                                </div>
                            </div>

                            {/* Bio Section */}
                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden max-w-2xl text-left border border-white/10 bg-white/5">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#ba9eff]/10 blur-[60px] rounded-full"></div>
                                <p className="font-bold text-sm text-[#ba9eff] mb-2 tracking-widest uppercase">{profile.full_name || "Citizen"}</p>
                                <p className="text-[#a9abb0] leading-relaxed text-sm">
                                    {profile.bio || "No bio available."}
                                    <br/><br/>
                                    {profile.assigned_area && <span className="text-[#53ddfc]">📍 {profile.assigned_area}</span>}
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Tabs Navigation */}
                <div className="max-w-6xl mx-auto px-6 lg:px-12 mb-8 mt-4">
                    <div className="flex justify-center md:justify-start border-t border-white/5 pt-4 gap-8 lg:gap-12">
                        <button onClick={() => setActiveTab('posts')} className={`flex items-center gap-2 pb-4 text-sm font-bold tracking-widest uppercase border-b-2 transition-colors ${activeTab === 'posts' ? 'border-[#ba9eff] text-[#ba9eff]' : 'border-transparent text-[#a9abb0] hover:text-[#f8f9fe]'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            Posts
                        </button>
                        <button onClick={() => setActiveTab('quix')} className={`flex items-center gap-2 pb-4 text-sm font-bold tracking-widest uppercase border-b-2 transition-colors ${activeTab === 'quix' ? 'border-[#ba9eff] text-[#ba9eff]' : 'border-transparent text-[#a9abb0] hover:text-[#f8f9fe]'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Quix
                        </button>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="max-w-6xl mx-auto px-6 lg:px-12 pb-24">
                    {loadingPosts ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" /></div>
                    ) : activeTab === 'posts' && posts.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-8">
                            {posts.map(post => (
                                <Link key={post.id} href={`/post/${post.id}`}>
                                    <div className="aspect-square relative group cursor-pointer overflow-hidden rounded-xl border border-white/5 glow-primary bg-zinc-900">
                                        {(post.media_urls && post.media_urls.length > 0) ? (
                                            post.media_type === "video" ? (
                                                <video src={post.media_urls[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            ) : (
                                                <img src={post.media_urls[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-900 p-4 font-body text-xs text-center text-zinc-400 group-hover:text-white transition-colors duration-500">
                                                {post.caption}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 lg:gap-6 pointer-events-none">
                                            <div className="flex items-center gap-2 font-bold text-white">
                                                <svg className="w-5 h-5 text-[#ff86c3]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg> 
                                                {post.likes_count || 0}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : activeTab === 'quix' && quixList.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 lg:gap-8">
                            {quixList.map(quix => (
                                <Link key={quix.id} href={`/quix?id=${quix.id}`}>
                                    <div className="aspect-[9/16] relative group cursor-pointer overflow-hidden rounded-xl border border-white/5 glow-primary bg-zinc-900">
                                        <img src={quix.thumbnail_url || quix.video_url?.replace(/\.[^/.]+$/, ".jpg")} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px] flex items-center justify-center gap-6">
                                            <svg className="w-8 h-8 text-[#ba9eff] fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full py-20 flex flex-col items-center justify-center text-[#a9abb0] border border-white/5 rounded-2xl border-dashed">
                            <h3 className="text-xl font-bold font-headline uppercase tracking-widest">{activeTab} EMPTY</h3>
                            <p className="font-mono text-sm mt-2">No content published in this dimension yet.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Obsidian Orb Decorative Accent */}
            <div className="fixed bottom-24 md:bottom-8 right-6 md:right-8 w-14 h-14 rounded-full glass-card flex items-center justify-center cursor-pointer group hover:scale-110 transition-all duration-300 z-50">
                <div className="absolute inset-0 rounded-full bg-[#ba9eff]/20 blur-xl group-hover:bg-[#ba9eff]/40 transition-all"></div>
                <svg className="w-6 h-6 text-[#ba9eff] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
        </div>
    );
}

export default function StitchProfile() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0c0e12] flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" /></div>}>
            <StitchProfileContent />
        </Suspense>
    );
}
