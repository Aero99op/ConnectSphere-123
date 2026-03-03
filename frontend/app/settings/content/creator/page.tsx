"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, BarChart3, TrendingUp, Users, Heart, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export default function CreatorToolsPage() {
    const { user: authUser, supabase } = useAuth();
    const [stats, setStats] = useState({
        totalPosts: 0,
        totalLikes: 0,
        totalFollowers: 0,
        avgEngagement: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchCreatorStats() {
            try {
                if (!authUser) { setIsLoading(false); return; }

                // Fetch posts for this user
                const { data: posts, error: postError } = await supabase
                    .from('posts')
                    .select('id')
                    .eq('user_id', authUser.id);

                // Fetch total likes (assume 'likes' table exists)
                const { count: likesCount } = await supabase
                    .from('likes')
                    .select('*', { count: 'exact', head: true })
                    .in('post_id', posts?.map(p => p.id) || []);

                // Fetch follower count
                const { count: followersCount } = await supabase
                    .from('follows')
                    .select('*', { count: 'exact', head: true })
                    .eq('following_id', authUser.id);

                setStats({
                    totalPosts: posts?.length || 0,
                    totalLikes: likesCount || 0,
                    totalFollowers: followersCount || 0,
                    avgEngagement: posts?.length ? Math.round(((likesCount || 0) / posts.length) * 10) / 10 : 0
                });
            } catch (error) {
                console.error("Error fetching creator stats:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchCreatorStats();
    }, [authUser, supabase]);

    const analyticsCards = [
        { label: "Total Reach", value: stats.totalLikes * 12 + stats.totalFollowers * 5, icon: TrendingUp, color: "text-blue-400" },
        { label: "Engagement", value: `${stats.avgEngagement}/post`, icon: Sparkles, color: "text-amber-400" },
        { label: "Community", value: stats.totalFollowers, icon: Users, color: "text-purple-400" },
        { label: "Total Hearts", value: stats.totalLikes, icon: Heart, color: "text-red-400" },
    ];

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] opacity-30" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Creator Tools</h1>
                        <p className="text-zinc-500 text-xs mt-1">Apni reach aur analytics dekho.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Stats Overview Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {analyticsCards.map((card, idx) => (
                                <div key={idx} className="glass p-5 rounded-3xl border-premium flex flex-col gap-3">
                                    <div className={`p-2 rounded-xl bg-white/5 w-fit ${card.color}`}>
                                        <card.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{card.label}</p>
                                        <p className="text-2xl font-display font-black text-white mt-1">{card.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Professional Status */}
                        <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-4">
                            <h2 className="text-sm font-display font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" /> Monetization Status
                            </h2>
                            <div className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-zinc-300">Creator Fund Eligibility</span>
                                    <span className="text-[10px] text-zinc-500">1,000 followers and 5,000 likes required.</span>
                                </div>
                                <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Not Eligible</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    Aapki posts ki reach badhane ke liye regularly upload karein aur community ke saath engage karein. Analytics har 24 ghante mein update hote hain.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
