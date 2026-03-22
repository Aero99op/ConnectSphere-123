"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Search, Edit, Users, ChevronLeft, Loader2, Settings, Sparkles } from "lucide-react";
import { NewChatDialog } from "./new-chat-dialog";
import { CreateGroupDialog } from "./create-group-dialog";
import { cn } from "@/lib/utils";
import { getApinatorClient } from "@/lib/apinator";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import Link from "next/link";
import { decryptMessageAndVerify, keyStore } from "@/lib/crypto/e2ee";

interface ChatSidebarProps {
    onSelectChat: (chat: any) => void;
    activeChatId?: string;
}

export function ChatSidebar({ onSelectChat, activeChatId }: ChatSidebarProps) {
    const { user: authUser, supabase } = useAuth();
    const { theme } = useTheme();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const userId = authUser?.id || null;
    const [showNewChat, setShowNewChat] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const decryptPreview = async (msg: any, currentUserId: string) => {
        if (!msg || !msg.iv || !msg.signature) return msg;
        try {
            const myEcdhPrivate = await keyStore.getKey("ecdh_private") as CryptoKey | undefined;
            const myMlkemPrivate = await keyStore.getKey("mlkem_private") as unknown as Uint8Array | undefined;
            if (!myEcdhPrivate) return msg;

            let senderEcdsa = msg.sender?.ecdsa_public_key;
            let senderEcdh = msg.sender?.ecdh_public_key;

            if (!senderEcdsa || !senderEcdh) {
                const { data } = await supabase.from('profiles').select('ecdsa_public_key, ecdh_public_key, username, full_name, avatar_url').eq('id', msg.sender_id).single();
                if (data) {
                    senderEcdsa = data.ecdsa_public_key;
                    senderEcdh = data.ecdh_public_key;
                }
            }

            if (senderEcdsa && senderEcdh && msg.encrypted_keys && msg.encrypted_keys[currentUserId]) {
                const decrypted = await decryptMessageAndVerify(
                    msg.content, msg.iv, msg.signature, msg.encrypted_keys[currentUserId],
                    senderEcdsa, senderEcdh, myEcdhPrivate, myMlkemPrivate
                );
                const parsed = JSON.parse(decrypted);
                return { ...msg, content: parsed.text || "📷 Media" };
            }
        } catch (e) {
            console.error("Preview Decryption Error:", e);
            return { ...msg, content: "🔒 [Secure Message]" };
        }
        return msg;
    };

    useEffect(() => {
        if (authUser) fetchConversations(authUser.id);
    }, [authUser]);

    // Apinator-based sidebar updates (BULLETPROOF — NEVER SLEEPS)
    useEffect(() => {
        if (!userId) return;
        let isMounted = true;

        const channelName = `private-sidebar-${userId}`;

        const bindSidebarEvents = (ch: any) => {
            ch.bind('conversation-update', async (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (payload.lastMessage) {
                    const decryptedMsg = await decryptPreview(payload.lastMessage, userId);
                    setConversations((prev) => {
                        const next = [...prev];
                        const idx = next.findIndex(c => c.id === payload.conversationId);
                        if (idx !== -1) {
                            next[idx] = {
                                ...next[idx],
                                last_message: decryptedMsg,
                                updated_at: decryptedMsg.created_at
                            };
                            const item = next.splice(idx, 1)[0];
                            return [item, ...next];
                        }
                        if (isMounted) fetchConversations(userId);
                        return prev;
                    });
                } else {
                    if (isMounted) fetchConversations(userId);
                }
            });
        };

        const client = getApinatorClient();
        if (!client) return;

        let channel = client.subscribe(channelName);
        bindSidebarEvents(channel);
        console.log(`[ChatSidebar] ✅ Subscribed to: ${channelName}`);

        // SELF-HEALING: Re-subscribe when connection recovers
        const handleStateChange = (states: any) => {
            if (states.current === 'connected' && isMounted) {
                const existing = client.channel(channelName);
                if (!existing || !existing.subscribed) {
                    console.log("[ChatSidebar] 🔄 Re-subscribing after reconnect...");
                    channel = client.subscribe(channelName);
                    bindSidebarEvents(channel);
                }
                fetchConversations(userId); // Catch up on missed messages
            }
        };
        client.bind('state_change', handleStateChange);

        fetchConversations(userId);

        return () => {
            isMounted = false;
            const c = getApinatorClient();
            if (c) {
                c.unbind('state_change', handleStateChange);
                c.unsubscribe(channelName);
            }
        };
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
                user1:profiles!user1_id(full_name, username, avatar_url, ecdsa_public_key, ecdh_public_key),
                user2:profiles!user2_id(full_name, username, avatar_url, ecdsa_public_key, ecdh_public_key)
            `)
            .order("updated_at", { ascending: false });

        if (!error && data) {
            const formatted = await Promise.all(data.map(async (conv: any) => {
                const { data: lastMsg } = await supabase
                    .from("messages")
                    .select("*")
                    .eq("conversation_id", conv.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let decryptedLastMsg = lastMsg;
                if (lastMsg) {
                    // Populate sender for decryptPreview
                    if (lastMsg.sender_id === conv.user1_id) {
                        lastMsg.sender = conv.user1;
                    } else if (lastMsg.sender_id === conv.user2_id) {
                        lastMsg.sender = conv.user2;
                    }
                    decryptedLastMsg = await decryptPreview(lastMsg, uid);
                }

                const common = {
                    id: conv.id,
                    updated_at: conv.updated_at,
                    last_message: decryptedLastMsg
                };

                if (conv.is_group) {
                    return {
                        ...common,
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
                        ...common,
                        recipient: {
                            id: otherUserId,
                            full_name: otherUser?.full_name || "Unknown User",
                            username: otherUser?.username || "unknown",
                            avatar_url: otherUser?.avatar_url || "",
                            is_group: false
                        }
                    };
                }
            }));
            setConversations(formatted);
        }
        setLoading(false);
    };

    const filteredConversations = conversations.filter(c =>
        c.recipient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.recipient?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!userId) return null;

    return (
        <div className={cn(
            "flex flex-col h-full shrink-0 transition-all duration-500",
            theme === 'radiant-void' 
                ? "bg-black border-r border-white/5 w-full md:w-[320px] lg:w-[380px]" 
                : "bg-black border-r border-white/10 w-full md:w-[350px] lg:w-[400px]"
        )}>
            {/* Header */}
            <div className={cn(
                "p-4 flex flex-col gap-4 sticky top-0 z-10",
                theme === 'radiant-void' 
                    ? "bg-black/40 backdrop-blur-xl border-b border-white/5" 
                    : "bg-black/95 backdrop-blur-md border-b border-white/10"
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className={cn(
                            "p-2 rounded-full transition-colors",
                            theme === 'radiant-void' ? "hover:bg-primary/10 text-zinc-400 hover:text-primary" : "hover:bg-white/10 text-white"
                        )}>
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <h2 className={cn(
                            "text-xl font-bold tracking-tight",
                            theme === 'radiant-void' ? "text-white uppercase italic font-display" : "text-white"
                        )}>
                            {theme === 'radiant-void' ? "Void Messenger" : "Guptugu"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowSettings(true)}
                            className={cn(
                                "p-2.5 rounded-full transition-colors",
                                theme === 'radiant-void' ? "hover:bg-white/5 text-zinc-500 hover:text-white" : "p-2.5 hover:bg-white/10 text-zinc-400 hover:text-white"
                            )}
                            title="Chat Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowCreateGroup(true)}
                            className={cn(
                                "p-2.5 rounded-full transition-colors",
                                theme === 'radiant-void' ? "hover:bg-cyan-500/10 text-cyan-400" : "hover:bg-white/10 text-cyan-400"
                            )}
                            title="Nayi Mandli"
                        >
                            <Users className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowNewChat(true)}
                            className={cn(
                                "p-2.5 rounded-full transition-colors",
                                theme === 'radiant-void' ? "hover:bg-primary/10 text-primary shadow-[0_0_10px_rgba(255,141,135,0.2)]" : "hover:bg-white/10 text-orange-400"
                            )}
                            title="Nayi Guptugu"
                        >
                            <Edit className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Search Bar - IG style rounded */}
                <div className="relative group">
                    <Search className={cn(
                        "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                        theme === 'radiant-void' ? "text-primary/50 group-focus-within:text-primary" : "text-zinc-500 group-focus-within:text-orange-500"
                    )} />
                    <input
                        type="text"
                        placeholder={theme === 'radiant-void' ? "Void mein dhoondo..." : "Doston ko dhoondo..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={cn(
                            "w-full py-2.5 pl-10 pr-4 text-sm transition-all focus:outline-none",
                            theme === 'radiant-void' 
                                ? "bg-zinc-900/40 border border-white/5 rounded-[12px] text-white focus:bg-zinc-900/80 focus:border-primary/30" 
                                : "bg-zinc-900/50 border border-white/5 rounded-2xl text-white focus:ring-1 focus:ring-orange-500/30 focus:bg-zinc-800/80"
                        )}
                    />
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar py-2">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className={cn("w-6 h-6 animate-spin", theme === 'radiant-void' ? "text-primary" : "text-orange-500")} />
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center space-y-4">
                        <MessageCircle className={cn("w-12 h-12", theme === 'radiant-void' ? "text-primary/20" : "text-zinc-700")} />
                        <p className={cn("text-sm", theme === 'radiant-void' ? "font-serif italic" : "")}>
                            Sannata chhaya hai...<br />Nayi guptugu shuru karein!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1 px-2">
                        {filteredConversations.map((chat) => (
                            <button
                                key={chat.id}
                                onClick={() => onSelectChat(chat)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-[12px] cursor-pointer transition-all border",
                                    activeChatId === chat.id
                                        ? (theme === 'radiant-void' 
                                            ? "bg-primary/10 border-primary/20 shadow-[0_0_20px_rgba(255,141,135,0.1)] scale-[1.02]" 
                                            : "bg-white/10 border-white/20 shadow-md")
                                        : (theme === 'radiant-void'
                                            ? "hover:bg-white/5 border-transparent"
                                            : "hover:bg-white/5 border-transparent")
                                )}
                            >
                                <Avatar className={cn(
                                    "w-12 h-12 transition-transform",
                                    theme === 'radiant-void' ? "rounded-lg border-white/5 group-hover:scale-105" : "border-white/10"
                                )}>
                                    <AvatarImage src={chat.recipient.avatar_url} />
                                    <AvatarFallback>{chat.recipient.full_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <p className={cn(
                                            "font-semibold text-[15px] truncate",
                                            theme === 'radiant-void' ? "text-white uppercase tracking-tight" : "text-white"
                                        )}>{chat.recipient.full_name}</p>
                                        {chat.last_message && (
                                            <span className={cn(
                                                "text-[10px] whitespace-nowrap",
                                                theme === 'radiant-void' ? "text-primary/70 font-mono" : "text-zinc-500"
                                            )}>
                                                {new Date(chat.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={cn(
                                            "text-xs truncate flex-1",
                                            theme === 'radiant-void' ? "text-zinc-400 font-serif italic" : "text-zinc-400"
                                        )}>
                                            {chat.last_message
                                                ? (chat.last_message.sender_id === userId ? "You: " : "") + chat.last_message.content
                                                : (chat.recipient.is_group ? "Mandli started" : `@${chat.recipient.username}`)}
                                        </p>
                                        {chat.last_message?.is_read === false && chat.last_message.sender_id !== userId && (
                                            <div className={cn(
                                                "w-2 h-2 rounded-full shrink-0 shadow-lg",
                                                theme === 'radiant-void' ? "bg-primary" : "bg-orange-500"
                                            )} />
                                        )}
                                    </div>
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

            {showSettings && (
                <ChatSettingsDialog onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
}
