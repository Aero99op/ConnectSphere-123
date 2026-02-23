"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, X, Loader2, Plus } from "lucide-react";
import { ChatWindow } from "./chat-window";
import { CreateGroupDialog } from "./create-group-dialog";

import { NewChatDialog } from "./new-chat-dialog";

export function ChatList() {
    const [isOpen, setIsOpen] = useState(false);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
            if (user) fetchConversations(user.id);
        };
        getUser();

        // Subscribe to new conversations
        const channel = supabase.channel('conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
                if (userId) fetchConversations(userId);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId]); // Re-fetch when userId is set

    const fetchConversations = async (uid: string) => {
        setLoading(true);
        // Fetch conversations (RLS policies filter what I can see)
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
                            id: conv.id, // Group ID
                            full_name: conv.group_name || "Group Chat",
                            username: "group",
                            avatar_url: conv.group_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${conv.group_name}`,
                            is_group: true
                        }
                    };
                } else {
                    // DM Logic
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

    if (!userId) return null; // Don't show if not logged in

    return (
        <>
            {/* ... (keep floating button unchanged) ... */}
            {!isOpen && !activeChat && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 bg-primary hover:bg-primary/90 text-white p-4 rounded-full shadow-2xl z-50 transition-transform hover:scale-110"
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
            )}

            {/* Chat List Window */}
            {isOpen && !activeChat && (
                <div className="fixed bottom-4 right-4 w-80 h-96 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-primary/90 p-3 flex items-center justify-between text-white shadow-md">
                        <span className="font-bold">Guptugu (Chats)</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setShowNewChat(true)} className="hover:bg-white/20 p-1 rounded-full text-white" title="New Chat">
                                <Plus className="w-5 h-5" />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Modals */}
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
                                setActiveChat(chat);
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

                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black/95">
                        {loading ? (
                            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" /></div>
                        ) : conversations.length === 0 ? (
                            <div className="text-center text-zinc-500 mt-10 text-sm p-4">
                                No chats yet.<br />Click + to start a conversation!
                            </div>
                        ) : (
                            conversations.map((chat) => (
                                <div
                                    key={chat.id}
                                    onClick={() => setActiveChat(chat)}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
                                >
                                    <Avatar>
                                        <AvatarImage src={chat.recipient.avatar_url} />
                                        <AvatarFallback>{chat.recipient.full_name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-white truncate">{chat.recipient.full_name}</p>
                                        <p className="text-xs text-zinc-400 truncate">@{chat.recipient.username}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Active Chat Window */}
            {activeChat && (
                <ChatWindow
                    conversationId={activeChat.id}
                    recipientName={activeChat.recipient.full_name}
                    recipientAvatar={activeChat.recipient.avatar_url}
                    recipientId={activeChat.recipient.id}
                    isGroup={activeChat.recipient.is_group}
                    currentUserId={userId}
                    onClose={() => setActiveChat(null)}
                />
            )}
        </>
    );
}
