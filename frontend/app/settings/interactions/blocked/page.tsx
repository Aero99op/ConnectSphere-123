"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, UserX, Loader2, Search, Unlink2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export default function BlockedAccountsPage() {
    const { user: authUser, supabase } = useAuth();
    const userId = authUser?.id || null;
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUnblocking, setIsUnblocking] = useState<string | null>(null);

    useEffect(() => {
        async function fetchBlockedUsers() {
            try {
                if (!authUser) { setIsLoading(false); return; }

                // Assuming a 'blocked_users' table exists as per our plan
                const { data, error } = await supabase
                    .from('blocked_users')
                    .select(`
                        id,
                        blocked_id,
                        profiles:blocked_id (id, username, full_name, avatar_url)
                    `)
                    .eq('blocker_id', authUser.id);

                if (data) {
                    setBlockedUsers(data.map(item => item.profiles).filter(Boolean));
                }
            } catch (error) {
                console.error("Error fetching blocked users:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchBlockedUsers();
    }, [authUser, supabase]);

    const handleUnblock = async (targetId: string) => {
        if (!userId) return;
        setIsUnblocking(targetId);

        try {
            const { error } = await supabase
                .from('blocked_users')
                .delete()
                .match({ blocker_id: userId, blocked_id: targetId });

            if (error) throw error;

            setBlockedUsers(prev => prev.filter(u => u.id !== targetId));
            toast.success("User unblock ho gaya!");
        } catch (error: any) {
            console.error("Error unblocking user:", error);
            toast.error("Unblock nahi ho paaya.");
        } finally {
            setIsUnblocking(null);
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[100px] opacity-30" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Blocked Accounts</h1>
                        <p className="text-zinc-500 text-xs mt-1">In logo ko aapne ban kiya hua hai.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-6">

                        {blockedUsers.length > 0 ? (
                            <div className="space-y-4">
                                {blockedUsers.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="w-12 h-12 border border-white/10">
                                                <AvatarImage src={user.avatar_url} />
                                                <AvatarFallback className="bg-zinc-800 text-primary font-bold">
                                                    {user.username?.[0]?.toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-zinc-100">{user.full_name || user.username}</span>
                                                <span className="text-[10px] text-zinc-500 font-mono">@{user.username}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleUnblock(user.id)}
                                            disabled={isUnblocking === user.id}
                                            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-300 transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            {isUnblocking === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Unlink2 className="w-3.5 h-3.5" /> Unblock</>}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 space-y-4 opacity-50">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                    <UserX className="w-8 h-8 text-zinc-600" />
                                </div>
                                <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500">Koyi Blocked Nahi Hai</h3>
                                <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">Duniya haseen hai, sab dost hain.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
