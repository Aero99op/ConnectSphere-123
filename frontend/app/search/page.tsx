"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, Suspense } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, Compass, LayoutGrid, Users } from "lucide-react";
import Link from "next/link";
import { PostCard } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

function SearchPageContent() {
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

    const { theme } = useTheme();

    return (
        <div className={cn(
            "min-h-screen pb-32 p-4 sm:p-6 selection:bg-primary/30 transition-colors duration-500",
            theme === 'radiant-void' ? "bg-black" : "bg-[#050507]"
        )}>
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                {theme === 'radiant-void' ? (
                    <>
                        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]" />
                    </>
                ) : (
                    <>
                        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[100px] rounded-full" />
                    </>
                )}
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-8">
                <header>
                    <h1 className={cn(
                        "text-4xl sm:text-5xl font-display font-black tracking-tightest text-white",
                        theme === 'radiant-void' ? "uppercase italic" : "text-gradient"
                    )}>
                        Search_
                    </h1>
                    <p className={cn(
                        "text-[10px] font-mono font-black uppercase tracking-[0.3em] mt-3 ml-1",
                        theme === 'radiant-void' ? "text-primary/70" : "text-zinc-500"
                    )}>
                        System_Discovery_Protocol
                    </p>
                </header>

                <div className="relative group">
                    {/* Input Glow Underlay */}
                    <div className={cn(
                        "absolute -inset-1 blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 rounded-2xl",
                        theme === 'radiant-void' ? "bg-gradient-to-r from-primary via-accent to-primary" : "bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10"
                    )} />

                    <div className={cn(
                        "relative border transition-all duration-500 overflow-hidden",
                        theme === 'radiant-void' 
                            ? "bg-black/40 backdrop-blur-xl border-white/10 rounded-xl focus-within:border-primary/50" 
                            : "glass border-premium rounded-2xl shadow-premium-sm focus-within:shadow-premium-lg"
                    )}>
                        <Search className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-all",
                            theme === 'radiant-void' ? "text-primary group-focus-within:scale-125" : "text-zinc-500 group-focus-within:text-primary group-focus-within:scale-110"
                        )} />
                        <input
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={activeTab === 'users' ? "SEARCH_IDENTITY_FILES..." : "SEARCH_BROADCAST_ARCHIVE..."}
                            className={cn(
                                "w-full bg-transparent py-5 pl-12 pr-6 text-sm outline-none tracking-tight transition-all",
                                theme === 'radiant-void' ? "font-mono font-black uppercase placeholder:text-zinc-800 text-white" : "font-medium text-white placeholder:text-zinc-700"
                            )}
                        />
                        {loading && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className={cn(
                    "flex p-1 transition-all duration-500",
                    theme === 'radiant-void' ? "bg-white/5 border border-white/5 rounded-xl" : "bg-zinc-900/50 rounded-2xl border border-white/5"
                )}>
                    <button
                        onClick={() => setActiveTab("users")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg sm:rounded-xl transition-all font-bold text-xs uppercase tracking-widest",
                            activeTab === "users" 
                                ? (theme === 'radiant-void' ? "bg-primary text-black shadow-[0_0_20px_rgba(255,141,135,0.4)]" : "bg-primary text-white shadow-lg") 
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        Users
                    </button>
                    <button
                        onClick={() => setActiveTab("posts")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg sm:rounded-xl transition-all font-bold text-xs uppercase tracking-widest",
                            activeTab === "posts" 
                                ? (theme === 'radiant-void' ? "bg-primary text-black shadow-[0_0_20px_rgba(255,141,135,0.4)]" : "bg-primary text-white shadow-lg") 
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Posts
                    </button>
                </div>

                <div className="space-y-4">
                    {activeTab === 'users' ? (
                        userResults.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {userResults.map((user) => (
                                    <Link
                                        key={user.id}
                                        href={`/profile/${user.username}`}
                                        className="group relative"
                                    >
                                        <div className={cn(
                                            "absolute -inset-0.5 blur opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl",
                                            theme === 'radiant-void' ? "bg-gradient-to-r from-primary/40 to-accent/40" : "bg-gradient-to-r from-primary/20 to-secondary/20"
                                        )} />
                                        <div className={cn(
                                            "relative p-4 flex items-center justify-between hover:translate-x-1 transition-all",
                                            theme === 'radiant-void' ? "bg-black border border-white/5 rounded-xl" : "glass border-premium rounded-[1.5rem]"
                                        )}>
                                            <div className="flex items-center gap-4">
                                                <div className="relative shrink-0">
                                                    <div className={cn(
                                                        "absolute inset-0 blur-md rounded-full scale-0 group-hover:scale-110 transition-transform",
                                                        theme === 'radiant-void' ? "bg-primary/30" : "bg-primary/20"
                                                    )} />
                                                    <Avatar className={cn(
                                                        "w-12 h-12 border-2 relative z-10 transition-transform group-hover:scale-105",
                                                        theme === 'radiant-void' ? "rounded-lg border-primary/20" : "rounded-2xl border-zinc-900 ring-1 ring-white/10"
                                                    )}>
                                                        <AvatarImage src={user.avatar_url} className="object-cover" />
                                                        <AvatarFallback className="bg-zinc-800 text-primary font-display font-black">{user.username?.[0] || 'U'}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={cn(
                                                        "font-display font-black text-lg tracking-tighter group-hover:text-primary transition-colors truncate",
                                                        theme === 'radiant-void' ? "text-white uppercase italic" : "text-white"
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
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 shrink-0">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors group-hover:animate-pulse",
                                                    theme === 'radiant-void' ? "bg-primary/20 text-primary shadow-[0_0_10px_rgba(255,141,135,0.4)]" : "bg-primary/10 text-primary"
                                                )}>
                                                    <Compass className="w-4 h-4 rotate-90" />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            query.length > 1 && !loading && <EmptyState theme={theme} />
                        )
                    ) : (
                        postResults.length > 0 ? (
                            <div className="space-y-6">
                                {postResults.map((post) => (
                                    <PostCard key={post.id} post={post} />
                                ))}
                            </div>
                        ) : (
                            query.length > 1 && !loading && <EmptyState theme={theme} />
                        )
                    )}

                    {!query && !loading && ((activeTab === 'users' && userResults.length === 0) || (activeTab === 'posts' && postResults.length === 0)) && (
                        <div className="text-center py-24 opacity-30">
                            <div className={cn(
                                "w-20 h-20 rounded-full flex items-center justify-center border mx-auto mb-6 transition-all duration-700",
                                theme === 'radiant-void' ? "bg-primary/5 border-primary/20 shadow-[0_0_30px_rgba(255,141,135,0.1)]" : "bg-white/5 border-white/5"
                            )}>
                                <Search className={cn("w-10 h-10", theme === 'radiant-void' ? "text-primary" : "text-white")} />
                            </div>
                            <p className={cn(
                                "text-[10px] font-mono font-black uppercase tracking-[0.4em]",
                                theme === 'radiant-void' ? "text-primary/50" : "text-zinc-500"
                            )}>DISCOVER_NEW_CONNECTIONS</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>}>
            <SearchPageContent />
        </Suspense>
    );
}

function EmptyState({ theme }: { theme: string | undefined }) {
    return (
        <div className={cn(
            "p-16 text-center border-dashed opacity-60 transition-all duration-500",
            theme === 'radiant-void' ? "bg-zinc-900/5 border-white/5 rounded-2xl" : "glass rounded-[2.5rem] border-premium"
        )}>
            <h3 className={cn(
                "font-display font-black text-xl uppercase tracking-widest italic",
                theme === 'radiant-void' ? "text-zinc-500" : "text-zinc-500"
            )}>404_NOT_FOUND</h3>
            <p className="text-xs font-mono text-zinc-700 mt-2 uppercase tracking-widest">System could not locate the requested entity.</p>
        </div>
    );
}
