"use client";

import { useState, useEffect } from "react";
import { Users, X, Check, Search, CircleDashed, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface User {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
}

interface CreateGroupDialogProps {
    onClose: () => void;
    onGroupCreated: () => void;
}

export function CreateGroupDialog({ onClose, onGroupCreated }: CreateGroupDialogProps) {
    const [groupName, setGroupName] = useState("");
    const [query, setQuery] = useState("");
    const [friends, setFriends] = useState<User[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

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

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selected.size === 0) return;
        setCreating(true);

        const memberIds = Array.from(selected);

        // Call RPC function
        const { error } = await supabase
            .rpc('create_group_chat', {
                name: groupName,
                member_ids: memberIds
            });

        if (error) {
            console.error(error);
            toast.error("Group nahi ban paya. RPC check karo.");
        } else {
            toast.success("Nayi Mandli (Group) Taiyaar Hai! 🎉");
            onGroupCreated();
            onClose();
        }
        setCreating(false);
    };

    const filteredFriends = friends.filter(u =>
        u?.username?.toLowerCase().includes(query.toLowerCase()) ||
        u?.full_name?.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-500" /> Nayi Mandli
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5 flex-1 overflow-hidden flex flex-col">

                    {/* Group Name Input */}
                    <div>
                        <label className="text-xs text-zinc-400 font-bold mb-1.5 block uppercase tracking-wider">Mandli Ka Naam</label>
                        <input
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="e.g. Chai Tapri Gang, College Yaar"
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-zinc-600"
                            autoFocus
                        />
                    </div>

                    {/* Member Search */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <label className="text-xs text-zinc-400 font-bold mb-2 block uppercase tracking-wider">
                            Dost Jodo <span className="text-orange-500">{selected.size > 0 && `(${selected.size})`}</span>
                        </label>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                placeholder="Doston ko dhoondo..."
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="py-8 text-center"><CircleDashed className="w-6 h-6 animate-spin mx-auto text-orange-500" /></div>
                            ) : filteredFriends.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500">
                                    <p className="text-sm">Koi dost nahi mila bhai.</p>
                                </div>
                            ) : (
                                filteredFriends.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => toggleSelect(user.id)}
                                        className={cn(
                                            "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all",
                                            selected.has(user.id)
                                                ? "bg-orange-500/10 border border-orange-500/30 shadow-sm"
                                                : "hover:bg-white/5 border border-transparent"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-10 h-10 border border-white/5">
                                                <AvatarImage src={user.avatar_url} />
                                                <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-white">{user.full_name}</span>
                                                <span className="text-xs text-zinc-400">@{user.username}</span>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                            selected.has(user.id) ? "bg-orange-500 border-orange-500" : "border-zinc-600"
                                        )}>
                                            {selected.has(user.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex justify-end bg-zinc-900/50">
                    <button
                        onClick={handleCreate}
                        disabled={!groupName.trim() || selected.size === 0 || creating}
                        className="bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95"
                    >
                        {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {creating ? "Banaa rahe hain..." : "Mandli Banao"}
                    </button>
                </div>
            </div>
        </div>
    );
}
