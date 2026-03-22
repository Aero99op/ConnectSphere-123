"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getApinatorClient } from "@/lib/apinator";
import { syncPosts, syncStories, getLocalPosts, getLocalStories, saveLocalProfile, getLocalProfile } from "@/lib/offline-sync";
import { formatDistanceToNow } from "date-fns";
import { StitchPostCard } from "./stitch-post-card";

export function StitchHomeFeedContent() {
    const { user: authUser, supabase } = useAuth();
    const [posts, setPosts] = useState<any[]>([]);
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(true);
    const userId = authUser?.id || null;
    const [userProfile, setUserProfile] = useState<any>(null);
    const router = useRouter();

    const fetchStories = async (currentUserId: string | null) => {
        const localStories = await getLocalStories();
        
        const { data, error } = await supabase
            .from("stories")
            .select(`*, profiles (username, avatar_url)`)
            .gt('expires_at', new Date().toISOString())
            .order("created_at", { ascending: false });

        let formattedStories: any[] = [];
        if (!error && data && data.length > 0) {
            formattedStories = data.map(story => ({
                ...story,
                username: story.profiles?.username || "User",
                avatar_url: story.profiles?.avatar_url
            }));
            await syncStories(formattedStories);
        }

        const myAddStoryCard = {
            id: 'add-story-btn',
            user_id: currentUserId,
            username: 'Your Story',
            avatar_url: userProfile?.avatar_url || '',
            isAddButton: true
        };

        if (formattedStories.length === 0 && localStories.length === 0) {
            formattedStories = [
                { id: 'mock-2', username: 'Riya', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Riya', media_urls: ["https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80"], caption: "Selfie time! 📸" }
            ];
        }

        if (formattedStories.length > 0 || localStories.length > 0) {
            setStories([myAddStoryCard, ...(formattedStories.length > 0 ? formattedStories : localStories)]);
        } else {
            setStories([myAddStoryCard]);
        }
    };

    const fetchPosts = async () => {
        const localPosts = await getLocalPosts();
        if (localPosts.length > 0) {
            setPosts(localPosts);
            setLoading(false);
        }

        const { data, error } = await supabase
            .from("posts")
            .select(`*, profiles (username, full_name, avatar_url)`)
            .order("created_at", { ascending: false });

        let formattedPosts: any[] = [];
        if (!error && data && data.length > 0) {
            formattedPosts = data.map(post => ({
                ...post,
                username: post.profiles?.username || "Anonymous",
                display_name: post.profiles?.full_name || "Unknown",
                avatar_url: post.profiles?.avatar_url
            }));
            await syncPosts(formattedPosts);
        }

        if (formattedPosts.length > 0) {
            setPosts(formattedPosts);
        }
        setLoading(false);
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            if (authUser) {
                try {
                    const localProfile = await getLocalProfile(authUser.id);
                    if (localProfile) setUserProfile(localProfile);
                    const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url, role').eq('id', authUser.id).maybeSingle();
                    if (data) {
                        setUserProfile(data);
                        await saveLocalProfile(authUser.id, data);
                        if (data?.role === 'official') {
                            router.push('/dashboard');
                            return;
                        }
                    }
                } catch (e) {}
            }
            await Promise.all([fetchPosts(), fetchStories(authUser?.id || null)]);
            setIsInitializing(false);
        };
        init();
    }, [authUser, router, supabase]);

    if (isInitializing) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" />
            </div>
        );
    }

    return (
        <div className="bg-black text-[#f8f9fe] min-h-screen selection:bg-[#ba9eff]/30 selection:text-white overflow-x-hidden font-sans">
            <style dangerouslySetInnerHTML={{ __html: `
                .prism-clip { clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); }
                .glass-panel { backdrop-filter: blur(24px); background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); }
                .text-glow-violet { text-shadow: 0 0 15px rgba(186, 158, 255, 0.5); }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />

            {/* TopNavBar */}
            <nav className="fixed top-0 w-full z-50 bg-black/40 backdrop-blur-2xl border-b border-white/10 shadow-[0_8px_32px_rgba(139,92,246,0.15)] flex justify-between items-center px-6 h-16">
                <div className="flex items-center gap-8">
                    <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">Connect</span>
                    <div className="hidden md:flex items-center bg-white/5 px-4 py-2 rounded-full border border-white/10 w-96 group focus-within:border-[#53ddfc]/40 transition-all">
                        <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input className="bg-transparent border-none focus:ring-0 outline-none text-sm text-slate-200 placeholder:text-slate-500 w-full" placeholder="Search the obsidian..." type="text"/>
                    </div>
                </div>
                <div className="flex items-center gap-5">
                    <button className="text-slate-400 hover:text-violet-300 transition-all duration-300 scale-95 active:scale-90 relative">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#ff8bc5] rounded-full shadow-[0_0_8px_rgba(255,134,195,0.6)]"></span>
                    </button>
                    <Link href="/messages" className="text-slate-400 hover:text-violet-300 transition-all duration-300 scale-95 active:scale-90">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </Link>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#ba9eff] to-[#53ddfc] p-[1px] cursor-pointer shadow-lg shadow-[#ba9eff]/20">
                        <div className="w-full h-full rounded-full overflow-hidden">
                            <img className="w-full h-full object-cover" src={userProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"}/>
                        </div>
                    </div>
                </div>
            </nav>

            {/* SideNavBar (Left) */}
            <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-black flex flex-col py-8 gap-4 hidden md:flex pt-20 border-r border-white/5">
                <nav className="flex flex-col gap-1 px-4">
                    <Link href="/" className="flex items-center gap-4 px-4 py-3 text-violet-400 font-bold border-r-2 border-violet-500 bg-gradient-to-r from-violet-500/10 to-transparent transition-all duration-200">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                        <span className="font-medium text-sm tracking-wide">Home</span>
                    </Link>
                    <Link href="/search" className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <span className="font-medium text-sm tracking-wide">Search</span>
                    </Link>
                    <Link href="/quix" className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className="font-medium text-sm tracking-wide">Quix</span>
                    </Link>
                    <Link href="/create" className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="font-medium text-sm tracking-wide">Create</span>
                    </Link>
                    <Link href="/report" className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="font-medium text-sm tracking-wide">Report</span>
                    </Link>
                    <Link href={`/profile/${authUser?.id}`} className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="font-medium text-sm tracking-wide">Profile</span>
                    </Link>
                </nav>
            </aside>

            {/* SideNavBar (Right / Discovery) */}
            <aside className="h-screen w-80 fixed right-0 top-0 z-40 bg-black flex flex-col p-6 hidden lg:flex border-l border-white/5 pt-24 gap-8">
                <div>
                    <h3 className="text-lg font-bold text-slate-200 mb-1">Discovery</h3>
                    <p className="text-xs text-slate-500">Suggestions for you</p>
                </div>
                <div className="glass-panel rounded-2xl p-5 flex flex-col gap-6 shadow-xl">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full border border-[#53ddfc]/30 p-[2px]">
                                    <img className="w-full h-full object-cover rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9994ykQ_8YQt3G83LxYDBqdWLdjkEuifDHQC4j-72TzYf5hB3nXI4ZjbJigwwamt7aS_S4yS5kRLInhQFqZK37v4eFP1RthtALHhVx1Hr4U290Y4SFe3AwwKg_kLVOF9-qsJYGUALjRVBIJdy6MLwj7tqSzCqeDgtRrpADAgBmXv76OT69NGX7SMRcSqMKOivEe3NNov7SDmQbVO-0BKWn8nYy7CNWTW0M8vvGvFvUesqHjUr07aBT68fvVVJBvGmNkyrTNKu9Xg"/>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-100">Julian Voss</p>
                                    <p className="text-[10px] text-slate-500">Curator of Void</p>
                                </div>
                            </div>
                            <button className="text-[#53ddfc] text-[10px] font-bold tracking-widest uppercase hover:text-white transition-colors">Follow</button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="md:ml-64 lg:mr-80 min-h-screen pt-24 px-4 pb-20 max-w-4xl mx-auto">
                {/* Stories: Prism-Shaped */}
                <section className="mb-12 overflow-x-auto no-scrollbar flex gap-6 pb-4">
                    {stories.map((story) => (
                        <div key={story.id} className="flex flex-col items-center gap-3 shrink-0 cursor-pointer group">
                            <div className={`w-16 h-16 prism-clip p-[1px] ${story.isAddButton ? 'bg-zinc-900 group-hover:bg-[#ba9eff]' : 'bg-gradient-to-tr from-[#ba9eff] via-[#53ddfc] to-[#ff86c3]'}`}>
                                <div className="w-full h-full prism-clip bg-black overflow-hidden flex items-center justify-center">
                                    {story.isAddButton ? (
                                        <svg className="w-6 h-6 text-[#ba9eff] group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    ) : (
                                        <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src={story.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} />
                                    )}
                                </div>
                            </div>
                            <span className="text-[10px] font-medium text-slate-300">{story.username}</span>
                        </div>
                    ))}
                </section>

                {/* Post Feed */}
                <div className="flex flex-col gap-10">
                    {loading ? (
                        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" /></div>
                    ) : posts.map(post => (
                        <StitchPostCard key={post.id} post={post} />
                    ))}
                </div>
            </main>

            {/* Navigation Shell Mobile */}
            <div className="md:hidden fixed bottom-0 w-full h-16 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4 z-50">
                <Link href="/" className="text-[#53ddfc] scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></Link>
                <Link href="/search" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></Link>
                <Link href="/create" className="w-10 h-10 bg-gradient-to-tr from-[#ba9eff] to-[#53ddfc] rounded-full flex items-center justify-center text-black shadow-lg shadow-[#ba9eff]/30 scale-110"><svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></Link>
                <Link href="/report" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></Link>
                <Link href={`/profile/${authUser?.id}`} className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></Link>
            </div>
        </div>
    );
}

export default function StitchHomeFeed() {
    return (
        <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-black"><Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" /></div>}>
            <StitchHomeFeedContent />
        </Suspense>
    );
}
