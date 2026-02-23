"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function RightSidebarContent() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingFollows, setLoadingFollows] = useState<Record<string, boolean>>({});
    const router = useRouter();

    useEffect(() => {
        const fetchSidebarData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Fetch current user profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            setCurrentUser(profile);

            // 2. Fetch people they already follow to exclude them from suggestions
            const { data: follows } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);

            const followingIds = follows?.map(f => f.following_id) || [];
            const excludeIds = [...followingIds, user.id];

            // 3. Fetch 4 random suggestions excluding already followed and self
            // Note: For a real large-scale app, we might use an RPC call or simpler query logic,
            // but for this demo, fetching a handful of profiles and selecting 4 works.
            let query = supabase.from('profiles').select('*').limit(20);

            // Supabase doesn't natively support NOT IN with an empty array elegantly if not careful,
            // so we add it dynamically.
            if (excludeIds.length > 0) {
                query = query.not('id', 'in', `(${excludeIds.join(',')})`);
            }

            const { data: profiles } = await query;

            if (profiles) {
                // Shuffle array and take top 4
                const shuffled = profiles.sort(() => 0.5 - Math.random());
                setSuggestions(shuffled.slice(0, 4));
            }

            setLoading(false);
        };

        fetchSidebarData();
    }, []);

    const handleFollowToggle = async (targetId: string) => {
        if (!currentUser) return;

        setLoadingFollows(prev => ({ ...prev, [targetId]: true }));

        const { error } = await supabase
            .from('follows')
            .insert({ follower_id: currentUser.id, following_id: targetId });

        if (!error) {
            // Remove the followed user from suggestions
            setSuggestions(prev => prev.filter(user => user.id !== targetId));
        }

        setLoadingFollows(prev => ({ ...prev, [targetId]: false }));
    };

    if (loading) {
        return (
            <div className="hidden xl:block w-85 shrink-0 pt-8 pr-10 z-20">
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>
            </div>
        );
    }

    if (!currentUser) return null; // Don't show sidebar if not logged in

    return (
        <div className="hidden xl:block w-85 shrink-0 pt-8 pr-10 z-20">
            <div className="sticky top-12 space-y-8">

                {/* User Profile Summary */}
                <div className="flex items-center justify-between glass p-4 rounded-3xl border-premium shadow-premium-lg">
                    <Link href={`/profile/${currentUser.id}`} className="flex items-center gap-3.5 group cursor-pointer">
                        <Avatar className="w-12 h-12 border-premium ring-2 ring-white/5 shadow-xl transition-transform group-hover:scale-105">
                            <AvatarImage src={currentUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`} />
                            <AvatarFallback className="bg-zinc-900 border border-white/5 text-primary text-lg font-black font-display">
                                {currentUser.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-display font-bold text-[15px] text-white tracking-tight group-hover:text-primary transition-colors">
                                {currentUser.username}
                            </span>
                            <span className="text-zinc-500 text-xs font-medium capitalize">
                                {currentUser.role} Account
                            </span>
                        </div>
                    </Link>
                    <button
                        onClick={() => router.push('/search')}
                        className="text-xs font-black text-primary hover:text-white transition-all uppercase tracking-widest px-3 py-1.5 rounded-xl border border-primary/20 shrink-0 hover:border-white/20 active:scale-95"
                    >
                        Search
                    </button>
                </div>

                {/* Suggestions Section */}
                {suggestions.length > 0 && (
                    <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-sm font-display font-black text-zinc-400 uppercase tracking-widest">Sifarish (Suggestions)</span>
                            <Link href="/search" className="text-[11px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">See All</Link>
                        </div>

                        <div className="space-y-6">
                            {suggestions.map(user => (
                                <div key={user.id} className="flex items-center justify-between group">
                                    <Link href={`/profile/${user.id}`} className="flex items-center gap-3.5 cursor-pointer max-w-[140px]">
                                        <Avatar className="w-11 h-11 border-premium ring-1 ring-white/5 group-hover:scale-110 transition-transform shadow-lg shrink-0">
                                            <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} />
                                            <AvatarFallback className="bg-zinc-900 text-zinc-500 text-xs font-bold border border-white/5">
                                                {user.username?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-display font-bold text-sm text-zinc-100 group-hover:text-primary transition-colors tracking-tight truncate">
                                                {user.username}
                                            </span>
                                            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest opacity-60 truncate">
                                                {user.role}
                                            </span>
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => handleFollowToggle(user.id)}
                                        disabled={loadingFollows[user.id]}
                                        className="text-xs font-black text-primary hover:text-white px-2 py-1 transition-all uppercase tracking-tighter shrink-0 active:scale-95"
                                    >
                                        {loadingFollows[user.id] ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Follow'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Info */}
                <div className="px-6 space-y-4 opacity-30 group hover:opacity-100 transition-opacity">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                        <span>About</span>
                        <span>Help</span>
                        <span>Press</span>
                        <span>API</span>
                        <span>Jobs</span>
                        <span>Privacy</span>
                        <span>Terms</span>
                    </div>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">© 2026 ConnectSphere by Team 900B</p>
                </div>
            </div>
        </div>
    );
}

export function RightSidebar() {
    return (
        <Suspense fallback={null}>
            <RightSidebarContent />
        </Suspense>
    );
}
