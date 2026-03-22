"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2, Search, Heart, MessageCircle, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

function StitchSearchContent() {
    const { user, supabase } = useAuth();
    const router = useRouter();

    const [query, setQuery] = useState("");
    const [userResults, setUserResults] = useState<any[]>([]);
    const [postResults, setPostResults] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"users" | "posts">("users");
    const [loading, setLoading] = useState(true);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const fetchResults = async (searchQuery: string) => {
        setLoading(true);
        try {
            const url = searchQuery.trim()
                ? `/api/search?q=${encodeURIComponent(searchQuery)}&type=all`
                : `/api/search?type=all`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            setUserResults(data.users || []);
            setPostResults(data.posts || []);
        } catch (err) {
            console.error('Search error:', err);
            setUserResults([]);
            setPostResults([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResults("");
    }, []);

    const handleSearch = (val: string) => {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchResults(val);
        }, 300);
    };

    const formatCount = (num: number) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    return (
        <div className="bg-[#000000] text-[#f8f9fe] font-body selection:bg-[#ba9eff]/30 min-h-screen">
            <style dangerouslySetInnerHTML={{ __html: `
                .glass-card { background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); }
                .neon-glow-primary { box-shadow: 0 0 25px rgba(186, 158, 255, 0.25); }
                .neon-glow-secondary { box-shadow: 0 0 25px rgba(83, 221, 252, 0.2); }
                .font-headline { font-family: 'Plus Jakarta Sans', sans-serif; }
            `}} />

            {/* Side Navigation Shell */}
            <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-[#000000] border-r border-white/5 flex flex-col py-8 px-4 gap-y-4 hidden md:flex">
                <div className="mb-10 px-4 cursor-pointer" onClick={() => router.push('/')}>
                    <h1 className="text-xl font-black text-violet-500 font-headline tracking-tighter">Connect</h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">Elite Network</p>
                </div>
                <nav className="flex flex-col space-y-2 flex-grow">
                    <Link href="/" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1 rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        <span className="font-medium text-sm">Home</span>
                    </Link>
                    <div className="flex items-center gap-3 text-[#53ddfc] bg-white/5 rounded-xl border-l-4 border-[#53ddfc] px-4 py-3 shadow-[0_0_15px_rgba(83,221,252,0.15)] transition-all duration-300">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <span className="font-medium text-sm font-bold">Search</span>
                    </div>
                    <Link href="/quix" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1 rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        <span className="font-medium text-sm">Quix</span>
                    </Link>
                    <Link href="/create" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1 rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                        <span className="font-medium text-sm">Create</span>
                    </Link>
                    <Link href="/report" className="flex items-center gap-3 text-slate-400 px-4 py-3 hover:bg-white/10 hover:text-violet-200 transition-all duration-300 hover:translate-x-1 rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <span className="font-medium text-sm">Report</span>
                    </Link>
                    <Link href={`/profile/${user?.id}`} className="flex items-center gap-3 text-slate-400 hover:bg-white/10 hover:text-violet-200 px-4 py-3 rounded-xl hover:translate-x-1 transition-all">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span className="font-medium text-sm">Profile</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="md:ml-64 min-h-screen relative overflow-hidden bg-[#000000] pb-20">
                {/* Atmospheric Background Accents */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ba9eff]/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#53ddfc]/10 rounded-full blur-[120px] pointer-events-none"></div>

                {/* Search Header Area */}
                <header className="sticky top-0 z-30 bg-[#000000]/80 backdrop-blur-xl px-4 md:px-6 pt-8 pb-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#53ddfc] transition-colors w-5 h-5" />
                            <input
                                value={query}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full bg-[#111417] border-none rounded-full py-4 pl-12 pr-6 text-[#f8f9fe] focus:ring-0 placeholder:text-slate-500 font-body transition-all group-focus-within:neon-glow-secondary outline-none"
                                placeholder="Search creators, posts..."
                                type="text"
                            />
                            <div className="absolute bottom-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#53ddfc]/40 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500"></div>
                            {loading && (
                                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-[#53ddfc]" />
                            )}
                        </div>

                        <nav className="flex gap-x-8 mt-8 border-b border-white/5">
                            <button
                                onClick={() => setActiveTab('users')}
                                className={cn("pb-4 px-2 text-sm font-bold tracking-wider relative font-headline transition-colors", activeTab === 'users' ? 'text-[#ba9eff]' : 'text-slate-500 hover:text-slate-300')}
                            >
                                Users
                                {activeTab === 'users' && <span className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#ba9eff] shadow-[0_0_15px_rgba(186,158,255,1)] rounded-full"></span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('posts')}
                                className={cn("pb-4 px-2 text-sm font-bold tracking-wider relative font-headline transition-colors", activeTab === 'posts' ? 'text-[#ba9eff]' : 'text-slate-500 hover:text-slate-300')}
                            >
                                Posts
                                {activeTab === 'posts' && <span className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#ba9eff] shadow-[0_0_15px_rgba(186,158,255,1)] rounded-full"></span>}
                            </button>
                        </nav>
                    </div>
                </header>

                {/* Search Results Grid */}
                <section className="max-w-5xl mx-auto px-4 md:px-6 py-8">
                    {activeTab === 'users' ? (
                        userResults.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {userResults.map((usr) => (
                                    <Link key={usr.id} href={`/profile/${usr.username}`}>
                                        <div className="glass-card rounded-2xl p-6 flex items-start gap-x-5 group hover:border-[#ba9eff]/40 hover:bg-white/[0.02] transition-all duration-300 cursor-pointer">
                                            <div className="relative shrink-0">
                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white/10 p-1 group-hover:border-[#ba9eff] transition-colors">
                                                    <img src={usr.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-full h-full object-cover rounded-full" />
                                                </div>
                                                {usr.role === 'verified' && (
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-[#53ddfc] rounded-full flex items-center justify-center border-2 border-black">
                                                        <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0 pr-2">
                                                        <h3 className="text-lg font-bold font-headline leading-tight tracking-tight truncate">{usr.full_name || usr.username}</h3>
                                                        <p className="text-[#53ddfc] text-xs font-medium font-body mt-0.5 truncate">@{usr.username}</p>
                                                    </div>
                                                    <button className="shrink-0 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#ba9eff] text-white font-bold text-xs py-2 px-4 md:px-6 rounded-full transition-all active:scale-95 group-hover:neon-glow-primary">
                                                        View
                                                    </button>
                                                </div>
                                                <p className="mt-3 text-sm text-slate-400 font-body leading-relaxed line-clamp-2">
                                                    {usr.bio || "No bio available."}
                                                </p>
                                                <div className="mt-4 flex gap-x-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                                    <span>{formatCount(usr.followers_count || 0)} followers</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : query.length > 0 && !loading ? (
                            <div className="w-full py-20 flex flex-col items-center justify-center text-slate-500">
                                <h3 className="text-xl font-bold font-headline uppercase">No users found</h3>
                            </div>
                        ) : null
                    ) : (
                        postResults.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {postResults.map((post) => (
                                    <Link href={`/post/${post.id}`} key={post.id} className="block">
                                        <div className="glass-card rounded-2xl overflow-hidden group hover:border-[#ba9eff]/30 hover:bg-white/[0.08] transition-all duration-300 h-full">
                                            <div className="aspect-video w-full overflow-hidden relative bg-zinc-900 flex items-center justify-center">
                                                {post.media_urls && post.media_urls.length > 0 ? (
                                                    post.media_type === "video" ? (
                                                        <video src={post.media_urls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    ) : (
                                                        <img src={post.media_urls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    )
                                                ) : (
                                                    <div className="w-full h-full p-4 flex items-center justify-center text-center text-xs text-white/50 bg-gradient-to-br from-zinc-800 to-black group-hover:scale-110 transition-transform duration-700">
                                                        Text Post
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-5">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <img src={post.profiles?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-6 h-6 rounded-full object-cover border border-white/20" />
                                                    <span className="text-xs font-bold text-slate-300 truncate">@{post.profiles?.username}</span>
                                                </div>
                                                <p className="text-sm text-slate-400 font-body line-clamp-2">{post.caption || "No caption provided."}</p>
                                                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    <div className="flex gap-4">
                                                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {formatCount(post.likes_count || 0)}</span>
                                                        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {formatCount(post.comments_count || 0)}</span>
                                                    </div>
                                                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : query.length > 0 && !loading ? (
                            <div className="w-full py-20 flex flex-col items-center justify-center text-slate-500">
                                <h3 className="text-xl font-bold font-headline uppercase">No posts found</h3>
                            </div>
                        ) : null
                    )}
                </section>
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-xl border-t border-white/5 flex justify-around items-center h-16 px-4 z-50">
                <Link href="/" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg></Link>
                <Link href="/search" className="text-[#53ddfc] scale-105 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></Link>
                <Link href="/create" className="w-10 h-10 bg-gradient-to-tr from-[#ba9eff] to-[#53ddfc] rounded-full flex items-center justify-center text-black shadow-lg shadow-[#ba9eff]/30 scale-110"><svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></Link>
                <Link href="/quix" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></Link>
                <Link href={`/profile/${user?.id}`} className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></Link>
            </nav>
        </div>
    );
}

export default function StitchSearch() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" /></div>}>
            <StitchSearchContent />
        </Suspense>
    );
}
