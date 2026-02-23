"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, Compass } from "lucide-react";
import Link from "next/link";

function SearchPageContent() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInitial = async () => {
            const { data } = await supabase.from("profiles").select("*").limit(50);
            setResults(data || []);
            setLoading(false);
        };
        fetchInitial();
    }, []);

    const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);

        setLoading(true);

        if (val.trim() === "") {
            const { data } = await supabase.from("profiles").select("*").limit(50);
            setResults(data || []);
            setLoading(false);
            return;
        }

        const { data } = await supabase
            .from("profiles")
            .select("*")
            .or(`username.ilike.%${val}%,full_name.ilike.%${val}%`)
            .limit(30);

        setResults(data || []);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#050507] pb-32 p-6 selection:bg-primary/30">
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[100px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-8">
                <header>
                    <h1 className="text-4xl font-display font-black text-gradient tracking-tightest">
                        Search_
                    </h1>
                    <p className="text-[10px] font-mono font-black text-zinc-600 uppercase tracking-[0.4em] mt-2 ml-1">
                        Scanning Central_Datavault
                    </p>
                </header>

                <div className="relative group">
                    {/* Input Glow Underlay */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 rounded-2xl" />

                    <div className="relative glass border-premium rounded-2xl overflow-hidden shadow-premium-sm focus-within:shadow-premium-lg transition-all duration-500">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-primary group-focus-within:scale-110 transition-all" />
                        <input
                            value={query}
                            onChange={handleSearch}
                            placeholder="Search for friends..."
                            className="w-full bg-transparent py-5 pl-12 pr-6 text-sm font-medium text-white placeholder:text-zinc-700 outline-none tracking-tight"
                        />
                        {loading && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    {results.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {results.map((user, idx) => (
                                <Link
                                    key={user.id}
                                    href={`/profile/${user.id}`}
                                    className="group relative"
                                >
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
                                    <div className="relative glass border-premium p-4 rounded-[1.5rem] flex items-center justify-between hover:translate-x-1 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="relative shrink-0">
                                                <div className="absolute inset-0 bg-primary/20 blur-md rounded-full scale-0 group-hover:scale-100 transition-transform" />
                                                <Avatar className="w-12 h-12 border-2 border-zinc-900 ring-1 ring-white/10 relative z-10 transition-transform group-hover:scale-105">
                                                    <AvatarImage src={user.avatar_url} className="object-cover" />
                                                    <AvatarFallback className="bg-zinc-800 text-primary font-display font-black">{user.username?.[0] || 'U'}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-display font-black text-white text-lg tracking-tighter group-hover:text-primary transition-colors truncate">
                                                    {user.full_name || user.username}
                                                </p>
                                                <p className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest truncate">
                                                    @{user.username}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:animate-pulse">
                                                <Compass className="w-4 h-4 rotate-90" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        query.length > 1 && !loading && (
                            <div className="glass-panel p-16 rounded-[2.5rem] text-center border-premium border-dashed opacity-60">
                                <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500 italic">404_ENT_NOT_FOUND</h3>
                                <p className="text-sm font-mono text-zinc-700 mt-2 uppercase tracking-widest">No results found!</p>
                            </div>
                        )
                    )}

                    {!query && !loading && results.length === 0 && (
                        <div className="text-center py-20 opacity-30">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/5 mx-auto mb-4">
                                <Search className="w-8 h-8 text-white" />
                            </div>
                            <p className="font-display font-black text-xs uppercase tracking-[0.4em]">Awaiting Input Sequence_</p>
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
