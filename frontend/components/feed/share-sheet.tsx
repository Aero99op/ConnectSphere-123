"use client";

import { useState, useEffect } from "react";
import { Search, Send, Check, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface User {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
}

interface ShareSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entityType: 'story' | 'post' | 'reel';
    entityId: string;
}

export function ShareSheet({ open, onOpenChange, entityType, entityId }: ShareSheetProps) {
    const [query, setQuery] = useState("");
    const [friends, setFriends] = useState<User[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // Mock Recommended for MVP
    const recommended: User[] = [
        { id: 'r1', username: 'top_creator', full_name: 'Viral Sensation', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Viral' },
        { id: 'r2', username: 'news_bot', full_name: 'City News', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=News' },
        { id: 'r3', username: 'meme_lord', full_name: 'Dank Memes', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Meme' },
    ];

    useEffect(() => {
        if (open) {
            fetchFriends();
            setSelected(new Set()); // Reset selection on open
            setQuery("");
        }
    }, [open]);

    const fetchFriends = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch users I follow
        const { data, error } = await supabase
            .from('follows')
            .select(`
                following_id,
                profiles:following_id (id, username, full_name, avatar_url)
            `)
            .eq('follower_id', user.id);

        if (data) {
            // @ts-ignore - Supabase type inference can be tricky with nested joins
            const formatted = data.map((d: any) => d.profiles).filter(Boolean);
            setFriends(formatted);
        }
        setLoading(false);
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (selected.size === 0) return;
        setSending(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const promises = Array.from(selected).map(async (recipientId) => {
            // 1. Find or Create Conversation
            // Note: This logic handles 1-on-1 chats. For Groups, logic differs.
            let convId;
            const { data: existing } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user1_id.eq.${user.id},user2_id.eq.${recipientId}),and(user1_id.eq.${recipientId},user2_id.eq.${user.id})`)
                .maybeSingle(); // Use maybeSingle to avoid error if not found

            if (existing) {
                convId = existing.id;
            } else {
                const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({ user1_id: user.id, user2_id: recipientId })
                    .select()
                    .single();
                convId = newConv?.id;
            }

            // 2. Insert Message with content ID
            if (convId) {
                await supabase.from('messages').insert({
                    conversation_id: convId,
                    sender_id: user.id,
                    content: entityType === 'post' ? 'Shared a post' : 'Shared a story',
                    post_id: entityType === 'post' ? entityId : null,
                    story_id: entityType === 'story' ? entityId : null
                });
            }
        });

        await Promise.all(promises);

        toast.success(`Sent to ${selected.size} people! 🚀`);
        setSending(false);
        onOpenChange(false);
    };

    const filteredFriends = friends.filter(u =>
        u.username.toLowerCase().includes(query.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(query.toLowerCase())
    );

    // Combine for display (Friends first, then Recommended)
    // If searching, search both. If not searching, show sections.

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-zinc-900 border-t border-white/10 h-[80vh] flex flex-col">
                <DrawerHeader className="border-b border-white/5 pb-4">
                    <DrawerTitle className="text-center text-white font-bold mb-4">Share to...</DrawerTitle>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            placeholder="Search people..."
                            className="w-full bg-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                </DrawerHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Friends Section */}
                    {filteredFriends.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Friends</h3>
                            {filteredFriends.map(user => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    selected={selected.has(user.id)}
                                    onToggle={() => toggleSelect(user.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Recommended Section (Only show if no search or matches search) */}
                    {recommended.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recommended</h3>
                            {recommended
                                .filter(u => !query || u.username.includes(query))
                                .map(user => (
                                    <UserRow
                                        key={user.id}
                                        user={user}
                                        selected={selected.has(user.id)}
                                        onToggle={() => toggleSelect(user.id)}
                                    />
                                ))}
                        </div>
                    )}

                    {filteredFriends.length === 0 && !query && (
                        <div className="text-center text-zinc-500 py-10">
                            <p>You haven't followed anyone yet.</p>
                            <p className="text-xs">Search for users to send to.</p>
                        </div>
                    )}
                </div>

                {/* Footer Send Button */}
                <div className="p-4 border-t border-white/10 bg-zinc-900 safebottom">
                    <button
                        onClick={handleSend}
                        disabled={selected.size === 0 || sending}
                        className={cn(
                            "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                            selected.size > 0 && !sending
                                ? "bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        )}
                    >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        {sending ? "Sending..." : `Send ${selected.size > 0 ? `(${selected.size})` : ''}`}
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

function UserRow({ user, selected, onToggle }: { user: User, selected: boolean, onToggle: () => void }) {
    return (
        <div
            onClick={onToggle}
            className={cn(
                "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors",
                selected ? "bg-white/10" : "hover:bg-white/5"
            )}
        >
            <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border border-white/10">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white leading-none">{user.full_name || user.username}</span>
                    <span className="text-xs text-zinc-400">@{user.username}</span>
                </div>
            </div>

            <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                selected ? "bg-cyan-500 border-cyan-500" : "border-zinc-600"
            )}>
                {selected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
            </div>
        </div>
    );
}
