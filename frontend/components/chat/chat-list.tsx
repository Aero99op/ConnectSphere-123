"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePeer } from "@/hooks/use-peer";
import { usePresence } from "@/components/providers/presence-provider";
import { formatLastSeen } from "@/lib/utils/presence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, X, Loader2, Plus } from "lucide-react";
import { ChatWindow } from "./chat-window";
import { CreateGroupDialog } from "./create-group-dialog";

import { NewChatDialog } from "./new-chat-dialog";

export function ChatList() {
    const { user: authUser, supabase } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const userId = authUser?.id || null;
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const { incomingSignal, clearSignal } = usePeer();
    const { isUserOnline } = usePresence();

    useEffect(() => {
        if (authUser) fetchConversations(authUser.id);
    }, [authUser]);

    // 📡 Handle Incoming Peer Signals and Profile Updates
    useEffect(() => {
        if (incomingSignal?.type === 'REFRESH_LIST' || incomingSignal?.type === 'NEW_MSG') {
            if (userId) fetchConversations(userId);
            clearSignal();
        }

        const profileSub = supabase
            .channel('public-profiles-sync')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles' },
                (payload) => {
                    const updatedProfile = payload.new;
                    setConversations(prev => prev.map(conv => {
                        if (!conv.is_group && conv.recipient.id === updatedProfile.id) {
                            return {
                                ...conv,
                                recipient: {
                                    ...conv.recipient,
                                    last_seen: updatedProfile.last_seen,
                                    is_online: updatedProfile.is_online
                                }
                            };
                        }
                        return conv;
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileSub);
        };
    }, [incomingSignal, userId]);

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
                user1:profiles!user1_id(id, full_name, username, avatar_url, last_seen, is_online, hide_online_status, ghost_mode_until),
                user2:profiles!user2_id(id, full_name, username, avatar_url, last_seen, is_online, hide_online_status, ghost_mode_until)
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
                            last_seen: otherUser?.last_seen || null,
                            is_online: otherUser?.is_online || false,
                            hide_online_status: otherUser?.hide_online_status || false,
                            ghost_mode_until: otherUser?.ghost_mode_until || null,
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
                                    <div className="relative">
                                        <Avatar>
                                            <AvatarImage src={chat.recipient.avatar_url} />
                                            <AvatarFallback>{chat.recipient.full_name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        {!chat.recipient.is_group && isUserOnline(chat.recipient.id) && !chat.recipient.hide_online_status && (!chat.recipient.ghost_mode_until || new Date(chat.recipient.ghost_mode_until) < new Date()) && (
                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-sm text-white truncate">{chat.recipient.full_name}</p>
                                            {!chat.recipient.is_group && (!isUserOnline(chat.recipient.id) || chat.recipient.hide_online_status || (chat.recipient.ghost_mode_until && new Date(chat.recipient.ghost_mode_until) > new Date())) && (
                                                <span className="text-[10px] text-zinc-500">
                                                    {(chat.recipient.hide_online_status || (chat.recipient.ghost_mode_until && new Date(chat.recipient.ghost_mode_until) > new Date())) 
                                                        ? 'Last seen hidden' 
                                                        : formatLastSeen(chat.recipient.last_seen)}
                                                </span>
                                            )}
                                        </div>
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
