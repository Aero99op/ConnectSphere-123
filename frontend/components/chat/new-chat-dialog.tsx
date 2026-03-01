"use client";

import { useState, useEffect } from "react";
import { Users, X, Search, CircleDashed, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface NewChatDialogProps {
    onClose: () => void;
    onCreateGroup: () => void;
    onChatStart: (conversation: any) => void;
    currentUserId: string;
}

export function NewChatDialog({ onClose, onCreateGroup, onChatStart, currentUserId }: NewChatDialogProps) {
    const [query, setQuery] = useState("");
    const [friends, setFriends] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch all users for MVP so we can easily find people
        const { data } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .neq('id', user.id)
            .limit(100);

        if (data) {
            setFriends(data);
        }
        setLoading(false);
    };

    const handleUserSelect = async (user: any) => {
        // Check if DM exists
        const { data: existing } = await supabase
            .from('conversations')
            .select('*')
            .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUserId})`)
            .single();

        if (existing) {
            // Found existing DM
            onChatStart({
                id: existing.id,
                recipient: {
                    id: user.id,
                    full_name: user.full_name,
                    username: user.username,
                    avatar_url: user.avatar_url,
                    is_group: false
                }
            });
        } else {
            // Create New DM
            const { data: newConv, error } = await supabase
                .from('conversations')
                .insert({ user1_id: currentUserId, user2_id: user.id })
                .select()
                .single();

            if (error) {
                toast.error("Could not start chat.");
                console.error(error);
            } else if (newConv) {
                onChatStart({
                    id: newConv.id,
                    recipient: {
                        id: user.id,
                        full_name: user.full_name,
                        username: user.username,
                        avatar_url: user.avatar_url,
                        is_group: false
                    }
                });
            }
        }
        onClose();
    };

    const filteredFriends = friends.filter(u =>
        u?.username?.toLowerCase().includes(query.toLowerCase()) ||
        u?.full_name?.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-orange-500" /> Nayi Guptugu
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col min-h-0 space-y-4">

                    {/* Create Group Option */}
                    <button
                        onClick={() => { onClose(); onCreateGroup(); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-900/20 to-zinc-900 border border-orange-500/20 hover:border-orange-500/50 hover:bg-white/5 transition-all group"
                    >
                        <div className="bg-orange-500/20 p-2 rounded-full group-hover:scale-110 transition-transform">
                            <Users className="w-5 h-5 text-orange-400" />
                        </div>
                        <div className="text-left">
                            <span className="block text-white font-bold text-sm group-hover:text-orange-400 transition-colors">Nayi Mandli Banao</span>
                            <span className="block text-zinc-400 text-xs">Desi style group chat with yaar-dost</span>
                        </div>
                    </button>

                    <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />

                    {/* Search Friends */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            placeholder="Doston ko dhoondo..."
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Friends List */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {loading ? (
                            <div className="py-8 text-center"><CircleDashed className="w-6 h-6 animate-spin mx-auto text-orange-500" /></div>
                        ) : filteredFriends.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-zinc-500 text-sm">Koi dost nahi mila bhai.</p>
                                <p className="text-zinc-600 text-xs mt-1">Naye logo se judo!</p>
                            </div>
                        ) : (
                            filteredFriends.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => handleUserSelect(user)}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                    <Avatar className="w-10 h-10">
                                        <AvatarImage src={user.avatar_url} />
                                        <AvatarFallback>{user.username?.[0] || user.full_name?.[0] || "?"}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-white">{user.full_name || "Unknown User"}</span>
                                        <span className="text-xs text-zinc-400">@{user.username || "unknown"}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
