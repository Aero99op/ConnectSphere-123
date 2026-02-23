"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Search, Edit, Users, ChevronLeft, Loader2 } from "lucide-react";
import { NewChatDialog } from "./new-chat-dialog";
import { CreateGroupDialog } from "./create-group-dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ChatSidebarProps {
    onSelectChat: (chat: any) => void;
    activeChatId?: string;
}

export function ChatSidebar({ onSelectChat, activeChatId }: ChatSidebarProps) {
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [showNewChat, setShowNewChat] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
            if (user) fetchConversations(user.id);
        };
        getUser();

        const channel = supabase.channel('conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
                if (userId) fetchConversations(userId);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const fetchConversations = async (uid: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from("conversations")
            .select(`
                id,
                user1_id,
                user2_id,
                is_group,
                group_name,
                group_avatar,
                updated_at,
                user1:profiles!user1_id(full_name, username, avatar_url),
                user2:profiles!user2_id(full_name, username, avatar_url)
            `)
            .order("updated_at", { ascending: false });

        if (!error && data) {
            const formatted = data.map((conv: any) => {
                if (conv.is_group) {
                    return {
                        id: conv.id,
                        recipient: {
                            id: conv.id,
                            full_name: conv.group_name || "Mandli",
                            username: "group",
                            avatar_url: conv.group_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${conv.group_name}`,
                            is_group: true
                        }
                    };
                } else {
                    const otherUserId = conv.user1_id === uid ? conv.user2_id : conv.user1_id;
                    const otherUser = conv.user1_id === uid ? conv.user2 : conv.user1;
                    return {
                        id: conv.id,
                        recipient: {
                            id: otherUserId,
                            full_name: otherUser?.full_name || "Unknown User",
                            username: otherUser?.username || "unknown",
                            avatar_url: otherUser?.avatar_url || "",
                            is_group: false
                        }
                    };
                }
            });
            setConversations(formatted);
        }
        setLoading(false);
    };

    const filteredConversations = conversations.filter(c =>
        c.recipient.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.recipient.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!userId) return null;

    return (
        <div className="flex flex-col h-full bg-black border-r border-white/10 w-full md:w-[350px] lg:w-[400px] shrink-0">
            {/* Header */}
            <div className="p-4 flex flex-col gap-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="md:hidden p-2 rounded-full hover:bg-white/10 text-white">
                            <ChevronLeft className="w-6 h-6" />
                        </Link>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageCircle className="w-6 h-6 text-orange-500" /> Guptugu
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCreateGroup(true)}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors"
                            title="Nayi Mandli (New Group)"
                        >
                            <Users className="w-5 h-5 text-cyan-400" />
                        </button>
                        <button
                            onClick={() => setShowNewChat(true)}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors"
                            title="Nayi Guptugu (New Chat)"
                        >
                            <Edit className="w-5 h-5 text-orange-400" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                    />
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar py-2">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center space-y-4">
                        <MessageCircle className="w-12 h-12 text-zinc-700" />
                        <p className="text-sm">Sannata chhaya hai...<br />Nayi guptugu shuru karein!</p>
                    </div>
                ) : (
                    <div className="space-y-1 px-2">
                        {filteredConversations.map((chat) => (
                            <button
                                key={chat.id}
                                onClick={() => onSelectChat(chat)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                                    activeChatId === chat.id
                                        ? "bg-white/10 border-white/20 shadow-md"
                                        : "hover:bg-white/5 border-transparent"
                                )}
                            >
                                <Avatar className="w-12 h-12 border border-white/10">
                                    <AvatarImage src={chat.recipient.avatar_url} />
                                    <AvatarFallback>{chat.recipient.full_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <p className="font-semibold text-[15px] text-white truncate">{chat.recipient.full_name}</p>
                                    </div>
                                    <p className="text-xs text-zinc-400 truncate">
                                        {chat.recipient.is_group ? "Tap to view Mandli" : `@${chat.recipient.username}`}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Dialogs */}
            {showNewChat && (
                <NewChatDialog
                    currentUserId={userId}
                    onClose={() => setShowNewChat(false)}
                    onCreateGroup={() => {
                        setShowNewChat(false);
                        setShowCreateGroup(true);
                    }}
                    onChatStart={(chat) => {
                        setShowNewChat(false);
                        onSelectChat(chat);
                    }}
                />
            )}

            {showCreateGroup && (
                <CreateGroupDialog
                    onClose={() => setShowCreateGroup(false)}
                    onGroupCreated={() => {
                        if (userId) fetchConversations(userId);
                    }}
                />
            )}
        </div>
    );
}
