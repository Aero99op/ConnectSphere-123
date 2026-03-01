"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimePresenceState } from "@supabase/supabase-js";
import { uploadToCatbox } from "@/lib/catbox";
import { Send, ChevronLeft, Loader2, Video, Phone, MoreVertical, Image as ImageIcon, Users, LogOut, Check, CheckCheck, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AddGroupMembersDialog } from "./add-group-members-dialog";

interface PresenceUser {
    userId: string;
    isTyping: boolean;
}

interface ChatViewProps {
    conversationId: string;
    recipientName: string;
    recipientAvatar?: string;
    recipientId: string;
    isGroup?: boolean;
    onBack: () => void;
    currentUserId: string;
}

export function ChatView({ conversationId, recipientName, recipientAvatar, recipientId, isGroup, onBack, currentUserId }: ChatViewProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [messageContextMenuId, setMessageContextMenuId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showStickers, setShowStickers] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        fetchMessages();

        const handleInserts = async (payload: any) => {
            const newMsg = payload.new;
            const { data } = await supabase.from('profiles').select('username, full_name, avatar_url').eq('id', newMsg.sender_id).single();
            if (data) {
                newMsg.sender = data;
            }
            if (isMounted) {
                setMessages((prev) => [...prev, newMsg]);
                scrollToBottom();
            }
        };

        const handleUpdates = (payload: any) => {
            const updatedMsg = payload.new;
            if (isMounted) {
                setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
            }
        };

        const channel = supabase
            .channel(`chat:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                handleInserts
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                handleUpdates
            )
            .on(
                'presence',
                { event: 'sync' },
                () => {
                    const newState: RealtimePresenceState = channel.presenceState();
                    const newTypers = new Set<string>();
                    for (const id in newState) {
                        const users = newState[id] as unknown as PresenceUser[];
                        for (const u of users) {
                            if (u.isTyping && u.userId !== currentUserId) {
                                newTypers.add(u.userId);
                            }
                        }
                    }
                    if (isMounted) setTypingUsers(newTypers);
                }
            )
            .subscribe(async (status: string, err: any) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        userId: currentUserId,
                        isTyping: false
                    });
                }
                if (err) console.error("ChatView subscribe error:", err);
            });

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [conversationId]);

    useEffect(() => {
        scrollToBottom();

        // Setup Intersection Observer for Read Receipts
        if (!messages.length) return;

        const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== currentUserId);
        if (unreadMessages.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const msgId = entry.target.getAttribute('data-message-id');
                    if (msgId) {
                        markMessageAsRead(msgId);
                        observer.unobserve(entry.target);
                    }
                }
            });
        }, { threshold: 0.5 }); // Message should be half visible

        unreadMessages.forEach(msg => {
            const el = document.getElementById(`msg-${msg.id}`);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [messages, currentUserId]);

    const markMessageAsRead = async (msgId: string) => {
        // Optimistic UI update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: true } : m));

        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', msgId);

        if (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMessages = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("messages")
            .select(`
                *,
                sender:profiles!sender_id(username, full_name, avatar_url),
                post:posts(*),
                story:stories(*)
            `)
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

        if (!error && data) {
            setMessages(data);
        }
        setLoading(false);
    };

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 100 * 1024 * 1024) { // 100MB limit for catbox (actually it's 200MB, but let's be safe)
            toast.error("File is too large! Maximum size is 100MB.");
            return;
        }

        setSelectedMedia(file);

        // Create preview
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            setMediaPreview(url);
        } else {
            setMediaPreview(null);
        }
    };

    const cancelMediaSelect = () => {
        setSelectedMedia(null);
        if (mediaPreview) {
            URL.revokeObjectURL(mediaPreview);
            setMediaPreview(null);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSend = async () => {
        if (!newMessage.trim() && !selectedMedia) return;

        const msgContent = newMessage.trim();

        if (editingMessageId && !selectedMedia) {
            setNewMessage("");
            const { error } = await supabase
                .from("messages")
                .update({ content: msgContent, is_edited: true })
                .eq("id", editingMessageId);

            setEditingMessageId(null);

            if (error) {
                console.error("Failed to update", error);
                toast.error("Sandesh update nahi hua");
            }
            return;
        }

        let mediaUrl = null;
        if (selectedMedia) {
            setIsUploading(true);
            try {
                mediaUrl = await uploadToCatbox(selectedMedia);
            } catch (err) {
                console.error("Upload failed", err);
                toast.error("Media upload fail ho gaya. Jugad band hua shayad.");
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        setNewMessage("");
        const mediaFile = selectedMedia;
        cancelMediaSelect();

        const newPayload: any = {
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: msgContent || "", // ensuring it's never exactly null if not needed, although nullable
            file_urls: mediaUrl ? [mediaUrl] : []
        };

        if (mediaFile) {
            newPayload.file_name = mediaFile.name;
            newPayload.file_size = mediaFile.size;
        }

        const { error } = await supabase
            .from("messages")
            .insert(newPayload);

        if (error) {
            console.error("Failed to send", error);
            toast.error("Sandesh bhej nahi paye");
        }
    };

    const handleDeleteMessageEveryone = async (msgId: string) => {
        if (!confirm("Delete this message for everyone?")) return;

        const { error } = await supabase
            .from("messages")
            .update({ content: "🚫 This message was deleted", is_deleted: true })
            .eq("id", msgId);

        if (error) {
            console.error("Failed to delete", error);
            toast.error("Sandesh delete nahi hua");
        }
        setMessageContextMenuId(null);
    };

    const handleDeleteMessageForMe = async (msgId: string) => {
        // Optimistic update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted_for: [...(m.deleted_for || []), currentUserId] } : m));

        const { error } = await supabase.rpc('delete_message_for_me', { msg_id: msgId });

        if (error) {
            console.error("Failed to delete for me", error);
            toast.error("Sandesh delete nahi hua");
            // Revert on error
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted_for: (m.deleted_for || []).filter((id: string) => id !== currentUserId) } : m));
        }
        setMessageContextMenuId(null);
    };

    const handleEditMessageClick = (msg: any) => {
        setEditingMessageId(msg.id);
        setNewMessage(msg.content);
        setMessageContextMenuId(null);
    };

    const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);

        const channel = supabase.channel(`chat:${conversationId}`);
        // Only track if successfully subscribed/joined
        if (channel.state === 'joined') {
            channel.track({
                userId: currentUserId,
                isTyping: true
            });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                channel.track({
                    userId: currentUserId,
                    isTyping: false
                });
            }, 2000);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startCall = async (type: "video" | "audio") => {
        if (!recipientId && !isGroup) {
            toast.error("Cannot call unknown user");
            return;
        }

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
        const callerName = profile?.full_name || profile?.username || "Someone";
        const callerAvatar = profile?.avatar_url || "https://github.com/shadcn.png";

        if (isGroup) {
            // 1. Dispatch local event directly for Group calls
            window.dispatchEvent(new CustomEvent('start-outgoing-call', {
                detail: {
                    roomId: conversationId,
                    remoteUserId: null, // Full mesh uses channel presence
                    callType: type,
                    isGroup: true
                }
            }));

            toast.success("Mandli call shuru ho rahi hai...");

            // 2. We need to notify all participants.
            // Ideally, we'd have a backend signal or loop through members.
            // Here we fetch members and send them a P2P incoming-call event
            const { data: participants } = await supabase
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', conversationId);

            if (participants) {
                // To avoid blocking, we send notifications asynchronously
                participants.forEach((p: any) => {
                    if (p.user_id === currentUserId) return;

                    const pChannel = supabase.channel(`user:${p.user_id}`);
                    const sendGroupInvite = async () => {
                        await pChannel.send({
                            type: "broadcast",
                            event: "incoming-call",
                            payload: {
                                roomId: conversationId,
                                callerId: currentUserId,
                                callerName: recipientName, // name of the group
                                callerAvatar: recipientAvatar,
                                callType: type,
                                isGroup: true
                            }
                        });
                        setTimeout(() => supabase.removeChannel(pChannel), 3000);
                    };

                    if (pChannel.state === 'joined') sendGroupInvite();
                    else pChannel.subscribe((status) => { if (status === 'SUBSCRIBED') sendGroupInvite(); });
                });
            }
            return;
        }

        const channel = supabase.channel(`user:${recipientId}`);

        const sendCall = async () => {
            // Trigger local call manager instantly to open window
            window.dispatchEvent(new CustomEvent('start-outgoing-call', {
                detail: {
                    roomId: conversationId,
                    remoteUserId: recipientId,
                    callType: type
                }
            }));
            toast.success("Bula rahe hain...");

            await channel.send({
                type: "broadcast",
                event: "incoming-call",
                payload: {
                    roomId: conversationId,
                    callerId: currentUserId,
                    callerName,
                    callerAvatar,
                    callType: type,
                    isGroup: false
                }
            });

            // Cleanup transient channel after sending to ensure delivery over slow networks
            setTimeout(() => {
                supabase.removeChannel(channel);
            }, 3000);
        };

        if (channel.state === 'joined') {
            sendCall();
        } else {
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    sendCall();
                }
            });
        }
    };

    const handleLeaveGroup = async () => {
        if (!isGroup) return;
        if (!confirm("Kya tum sach mein Mandli se nikalna chahte ho?")) return;

        const { error } = await supabase.rpc('leave_group', { conv_id: conversationId });
        if (error) {
            console.error("Failed to leave group", error);
            toast.error("Mandli chhod nahi paye. RPC check karo.");
        } else {
            toast.success("Mandli se nikal gaye.");
            onBack();
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0a] relative">
            {/* Header - Instagram Style Glassmorphism */}
            <div className="h-16 px-4 bg-black/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between sticky top-0 z-20 w-full shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white transition-all active:scale-90">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="relative group cursor-pointer">
                        <Avatar className="h-9 w-9 border border-white/10 ring-2 ring-transparent group-hover:ring-orange-500/30 transition-all">
                            <AvatarImage src={recipientAvatar} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400">{recipientName[0]}</AvatarFallback>
                        </Avatar>
                        {!isGroup && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full" />}
                    </div>
                    <div className="flex flex-col justify-center -space-y-0.5">
                        <span className="font-bold text-[15px] text-white tracking-tight">{recipientName}</span>
                        {isGroup ? (
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Mandli</span>
                        ) : (
                            <span className={cn("text-[11px] font-medium transition-colors", typingUsers.size > 0 ? "text-orange-400" : "text-zinc-400")}>
                                {typingUsers.size > 0 ? "typing..." : "Active now"}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-0.5">
                    <button onClick={() => startCall("audio")} className="p-2.5 hover:bg-white/10 rounded-full text-white/90 transition-colors" title="Voice Call">
                        <Phone className="w-5 h-5" />
                    </button>
                    <button onClick={() => startCall("video")} className="p-2.5 hover:bg-white/10 rounded-full text-white/90 transition-colors" title="Video Call">
                        <Video className="w-5 h-5" />
                    </button>
                    {isGroup && (
                        <div className="relative">
                            <button
                                onClick={() => setShowDropdown(prev => !prev)}
                                className="p-2.5 hover:bg-white/10 rounded-full text-white/90 transition-colors focus:outline-none"
                                title="More Info"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>

                            {/* Custom Dropdown Menu */}
                            {showDropdown && (
                                <>
                                    {/* Backdrop to close dropdown */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowDropdown(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl py-1 z-50 text-white animate-in fade-in zoom-in-95 origin-top-right">
                                        <button
                                            onClick={() => {
                                                setShowDropdown(false);
                                                setShowAddMembers(true);
                                            }}
                                            className="w-full"
                                        >
                                            <div className="flex w-full items-center px-4 py-2 text-sm cursor-pointer hover:bg-white/10 transition-colors">
                                                <Users className="w-4 h-4 mr-2" />
                                                <span>Naye Dost Jodo</span>
                                            </div>
                                        </button>
                                        <button className="w-full" onClick={() => {
                                            setShowDropdown(false);
                                            handleLeaveGroup();
                                        }}>
                                            <div className="flex w-full items-center px-4 py-2 text-sm cursor-pointer text-red-400 hover:bg-red-500/10 transition-colors">
                                                <LogOut className="w-4 h-4 mr-2" />
                                                <span>Mandli Chhodo</span>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#0a0a0a] to-[#0a0a0a]">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 mt-10 space-y-3">
                        <Avatar className="w-24 h-24 mb-4 border border-white/10 opacity-70">
                            <AvatarImage src={recipientAvatar} />
                            <AvatarFallback className="text-4xl">{recipientName[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-xl font-semibold text-white/80">{recipientName}</p>
                        <p className="text-sm text-center">
                            {isGroup ? "Mandli ban gayi hai. Guptugu shuru karein!" : `Say Namaste 🙏 to ${recipientName}`}
                        </p>
                    </div>
                ) : (
                    messages
                        .filter(msg => !msg.deleted_for?.includes(currentUserId))
                        .map((msg, index, visibleMsgs) => {
                            const isMe = msg.sender_id === currentUserId;
                            const showSender = isGroup && !isMe;
                            const prevMsg = index > 0 ? visibleMsgs[index - 1] : null;
                            const showAvatar = showSender && (!prevMsg || prevMsg.sender_id !== msg.sender_id);

                            return (
                                <div
                                    key={msg.id}
                                    id={`msg-${msg.id}`}
                                    data-message-id={msg.id}
                                    className={cn("flex flex-col gap-1 w-full", isMe ? "items-end" : "items-start")}
                                >
                                    {showAvatar && (
                                        <span className="text-[11px] text-zinc-500 ml-10 mb-0.5">
                                            {msg.sender?.full_name || msg.sender?.username || "Unknown"}
                                        </span>
                                    )}
                                    <div className={cn("flex gap-2 max-w-[85%] md:max-w-[70%]", isMe ? "flex-row-reverse" : "flex-row text-left")}>
                                        {showSender ? (
                                            <div className="w-8 shrink-0">
                                                {showAvatar && (
                                                    <Avatar className="w-8 h-8 border border-white/10">
                                                        <AvatarImage src={msg.sender?.avatar_url} />
                                                        <AvatarFallback>{msg.sender?.username?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                )}
                                            </div>
                                        ) : null}

                                        <div className={cn(
                                            "px-4 py-2.5 rounded-[20px] text-[15px] break-words flex flex-col gap-2 relative shadow-md",
                                            isMe ? "bg-gradient-to-br from-orange-600 to-orange-500 text-white rounded-tr-sm"
                                                : "bg-[#262626] text-zinc-100 rounded-tl-sm border border-white/5"
                                        )}>
                                            {/* Shared Post Preview */}
                                            {msg.post && (
                                                <div className="rounded-xl overflow-hidden border border-white/20 bg-black cursor-pointer hover:opacity-90 transition-opacity w-64 md:w-72">
                                                    <img
                                                        src={msg.post.thumbnail_url || msg.post.file_urls?.[0]}
                                                        alt="Shared Post"
                                                        className="w-full h-48 object-cover"
                                                    />
                                                    <div className="p-3 text-sm bg-black/60 backdrop-blur-sm text-white border-t border-white/10">
                                                        {msg.post.caption ? <span className="line-clamp-2">{msg.post.caption}</span> : "Shared a Post"}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Shared Story Preview */}
                                            {msg.story && (
                                                <div className="rounded-xl overflow-hidden border border-white/20 bg-black w-48 cursor-pointer hover:opacity-90 transition-opacity">
                                                    <img
                                                        src={msg.story.media_url}
                                                        alt="Shared Story"
                                                        className="w-full h-72 object-cover"
                                                    />
                                                    <div className="p-2 text-xs font-semibold text-center bg-gradient-to-t from-black to-transparent text-white absolute bottom-0 w-full">
                                                        Shared Story
                                                    </div>
                                                </div>
                                            )}

                                            {msg.content?.startsWith("[CALL_LOG]:") ? (() => {
                                                const parts = msg.content.split(":");
                                                const type = parts[1];
                                                const s = parseInt(parts[2]) || 0;
                                                const mStr = Math.floor(s / 60).toString();
                                                const sStr = (s % 60).toString().padStart(2, '0');
                                                return (
                                                    <div className="flex items-center gap-3 font-medium cursor-default px-1 py-0.5" onClick={() => !msg.is_deleted && setMessageContextMenuId(messageContextMenuId === msg.id ? null : msg.id)}>
                                                        <div className={cn("p-2 rounded-full", isMe ? "bg-white/20" : "bg-black/20")}>
                                                            {type === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span>{type === 'video' ? "Video Call" : "Voice Call"}</span>
                                                            <span className={cn("text-xs mt-0.5", s > 0 ? (isMe ? "text-orange-100" : "text-zinc-400") : "text-red-300 font-bold")}>
                                                                {s > 0 ? `${mStr}:${sStr}` : "Missed Call"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })() : (
                                                <div
                                                    className="flex flex-col cursor-pointer"
                                                    onClick={() => !msg.is_deleted && setMessageContextMenuId(messageContextMenuId === msg.id ? null : msg.id)}
                                                >
                                                    {/* Media Rendering */}
                                                    {!msg.is_deleted && msg.file_urls && msg.file_urls.length > 0 && (
                                                        <div className="mb-2 w-full max-w-[240px] md:max-w-[320px] rounded-lg overflow-hidden bg-black/20">
                                                            {msg.file_name?.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || msg.file_urls[0].toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) ? (
                                                                <img
                                                                    src={msg.file_urls[0]}
                                                                    alt={msg.file_name || "MMS Image"}
                                                                    className="w-full h-auto object-cover max-h-[300px]"
                                                                    loading="lazy"
                                                                />
                                                            ) : msg.file_name?.toLowerCase().match(/\.(mp4|webm|ogg)$/i) || msg.file_urls[0].toLowerCase().match(/\.(mp4|webm|ogg)$/i) ? (
                                                                <video
                                                                    src={msg.file_urls[0]}
                                                                    controls
                                                                    className="w-full max-h-[300px]"
                                                                    preload="metadata"
                                                                />
                                                            ) : msg.file_name?.toLowerCase().match(/\.(mp3|wav|ogg)$/i) || msg.file_urls[0].toLowerCase().match(/\.(mp3|wav|ogg)$/i) ? (
                                                                <div className="p-3 w-full bg-black/40 rounded-lg">
                                                                    <div className="text-xs mb-2 opacity-80 truncate">{msg.file_name || "Audio Note"}</div>
                                                                    <audio src={msg.file_urls[0]} controls className="w-full h-8" />
                                                                </div>
                                                            ) : (
                                                                <a
                                                                    href={msg.file_urls[0]}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 p-3 bg-black/40 hover:bg-black/60 transition-colors text-sm"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <ImageIcon className="w-5 h-5 shrink-0 opacity-70" />
                                                                    <span className="truncate flex-1">{msg.file_name || "Download Attachment"}</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}

                                                    {msg.content && (
                                                        <span className={cn("leading-snug whitespace-pre-wrap flex-wrap break-all", msg.is_deleted && "italic opacity-70")}>
                                                            {msg.content}
                                                        </span>
                                                    )}
                                                    {msg.is_edited && !msg.is_deleted && (
                                                        <span className="text-[10px] opacity-60 self-end mt-1 italic leading-none">edited</span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Message Context Menu (Edit/Delete) */}
                                            {messageContextMenuId === msg.id && !msg.is_deleted && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setMessageContextMenuId(null); }} />
                                                    <div className={cn(
                                                        "absolute z-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl py-1 w-32 animate-in fade-in zoom-in-95",
                                                        isMe ? "right-0 top-full mt-1" : "left-0 top-full mt-1"
                                                    )}>
                                                        {isMe && !msg.content?.startsWith("[CALL_LOG]:") && !msg.post && !msg.story && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditMessageClick(msg); }}
                                                                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteMessageForMe(msg.id); }}
                                                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                                        >
                                                            Delete for Me
                                                        </button>
                                                        {isMe && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteMessageEveryone(msg.id); }}
                                                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                                            >
                                                                Delete for Everyone
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                            {/* Read Receipts (Ticks) for outgoing messages */}
                                            {isMe && !msg.content?.startsWith("[CALL_LOG]:") && (
                                                <div className="absolute right-0 -bottom-4 flex items-center gap-0.5">
                                                    {msg.is_read ? (
                                                        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                                    ) : (
                                                        <Check className="w-3 h-3 text-zinc-400" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                )}
                {/* Typing Indicator Bubble */}
                {typingUsers.size > 0 && (
                    <div className="flex flex-col gap-1 w-full items-start animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <span className="text-[11px] text-zinc-500 ml-10 mb-0.5">
                            {isGroup ? `${Array.from(typingUsers).length} typing...` : 'typing...'}
                        </span>
                        <div className="flex gap-2 max-w-[85%] md:max-w-[70%] flex-row text-left">
                            <div className="w-8 shrink-0">
                                {isGroup && (
                                    <Avatar className="w-8 h-8 border border-white/10 opacity-70">
                                        <AvatarFallback>...</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                            <div className="px-4 py-3 rounded-[20px] bg-[#262626] border border-white/5 rounded-tl-sm flex items-center gap-1 shadow-md h-[42px]">
                                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area - Instagram Style Pill */}
            <div className="p-3 bg-black/95 backdrop-blur-xl border-t border-white/5 shrink-0 w-full pb-[max(0.75rem,env(safe-area-inset-bottom))] relative">

                {/* Media Preview Area */}
                {selectedMedia && (
                    <div className="absolute bottom-full left-0 right-0 p-3 bg-black/90 backdrop-blur-md border-t border-white/10 flex items-end gap-3 animate-in slide-in-from-bottom-2 z-10">
                        <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/20 inline-block">
                            {mediaPreview ? (
                                selectedMedia.type.startsWith('video/') ? (
                                    <video src={mediaPreview} className="h-24 max-w-[200px] object-cover" />
                                ) : (
                                    <img src={mediaPreview} className="h-24 w-auto object-cover mix-blend-screen" />
                                )
                            ) : (
                                <div className="h-24 w-24 flex items-center justify-center bg-zinc-800">
                                    <ImageIcon className="w-8 h-8 text-zinc-500" />
                                </div>
                            )}
                            <button
                                onClick={cancelMediaSelect}
                                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-red-500/80 transition-colors"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                        <div className="flex-1 pb-2">
                            <p className="text-sm font-medium text-white truncate">{selectedMedia.name}</p>
                            <p className="text-xs text-zinc-400">{(selectedMedia.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                )}

                <div className="max-w-4xl mx-auto flex items-end gap-2 bg-[#121212] border border-white/10 rounded-3xl p-1 shadow-inner relative z-20">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleMediaSelect}
                        className="hidden"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    />

                    <div className="flex items-center gap-1 self-end mb-1 ml-1 shrink-0">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 h-9 w-9 flex items-center justify-center text-white/90 hover:text-white transition-all hover:bg-white/10 rounded-full"
                            title="Attach Media"
                            disabled={isUploading}
                        >
                            <ImageIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowStickers(!showStickers)}
                            className={cn("p-2 h-9 w-9 flex items-center justify-center transition-all hover:bg-white/10 rounded-full", showStickers ? "text-orange-400 bg-white/10" : "text-white/90 hover:text-white")}
                            title="Stickers & GIFs"
                            disabled={isUploading}
                        >
                            <Smile className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 relative">
                        {showStickers && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowStickers(false)} />
                                <div className="absolute bottom-full mb-3 -left-16 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl p-3 z-40 animate-in fade-in zoom-in-95">
                                    <div className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Desi Stickers</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { url: "https://media1.tenor.com/m/h9Kx5C-7-F8AAAAd/chup-raho-chup.gif", name: "Chup" },
                                            { url: "https://media1.tenor.com/m/51bnsA0B-H4AAAAd/waah-kya-baat-hai.gif", name: "Waah" },
                                            { url: "https://media1.tenor.com/m/D7nnt5g0oR4AAAAd/kaisa-laga-mera-mazak-ajay-devgan.gif", name: "Mazak" },
                                            { url: "https://media1.tenor.com/m/-X8_P7vL-aUAAAAd/paisa-hi-paisa-hoga-akshay-kumar.gif", name: "Paisa" },
                                            { url: "https://media1.tenor.com/m/DntJ64R2ZtkAAAAC/jethalal-angry.gif", name: "Angry" },
                                            { url: "https://media1.tenor.com/m/hT0oVExyVGsAAAAd/mirzapur-munna-bhaiya.gif", name: "Jalwa" },
                                            { url: "https://media1.tenor.com/m/X_WqFz07L90AAAAd/welcome-majnu-bhai.gif", name: "Majnu" },
                                            { url: "https://media1.tenor.com/m/6y40Fts4bWwAAAAd/ab-mja-aaega-n-bhidu-ab-maza-aayega-na-bhidu.gif", name: "Maza" }
                                        ].map((sticker, i) => (
                                            <button
                                                key={i}
                                                onClick={async () => {
                                                    setShowStickers(false);
                                                    await supabase.from("messages").insert({
                                                        conversation_id: conversationId,
                                                        sender_id: currentUserId,
                                                        content: null,
                                                        file_urls: [sticker.url],
                                                        file_name: `${sticker.name}.gif`
                                                    });
                                                }}
                                                className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500 transition-all cursor-pointer bg-black/50"
                                            >
                                                <img src={sticker.url} alt={sticker.name} className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 text-[10px] text-center text-zinc-500">More stickers coming soon!</div>
                                </div>
                            </>
                        )}
                        <textarea
                            value={newMessage}
                            onChange={handleTyping}
                            onKeyDown={handleKeyPress}
                            placeholder={selectedMedia ? "Add a caption..." : "Message..."}
                            className="w-full bg-transparent border-none py-2.5 px-2 text-[15px] text-white focus:outline-none focus:ring-0 resize-none custom-scrollbar min-h-[42px] max-h-[120px] placeholder:text-zinc-500 leading-[1.2]"
                            rows={1}
                            style={{ height: Math.min(120, Math.max(42, newMessage.split('\n').length * 20 + 20)) }}
                            disabled={isUploading}
                        />
                    </div>
                    <div className="self-end mb-1 mr-1 shrink-0">
                        {newMessage.trim() || selectedMedia ? (
                            <div className="flex items-center gap-1">
                                {editingMessageId && !selectedMedia && (
                                    <button
                                        onClick={() => { setEditingMessageId(null); setNewMessage(""); }}
                                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                                        title="Cancel edit"
                                        disabled={isUploading}
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <button
                                    onClick={handleSend}
                                    disabled={isUploading}
                                    className={cn(
                                        "h-9 px-4 rounded-full font-semibold text-[14px] transition-all active:scale-95 flex items-center justify-center",
                                        isUploading ? "bg-orange-500/50 text-white/50 cursor-not-allowed" :
                                            editingMessageId ? "bg-blue-600 hover:bg-blue-500 text-white" :
                                                "bg-orange-600 hover:bg-orange-500 text-white"
                                    )}
                                >
                                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingMessageId ? "Update" : "Send"}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 pr-1">
                                {/* Placeholder icons for IG feel */}
                                <button onClick={() => startCall("video")} className="p-2 h-9 w-9 flex items-center justify-center text-white/90 hover:text-white transition-colors rounded-full hover:bg-white/10" title="Video Call">
                                    <Video className="w-5 h-5" />
                                </button>
                                <button onClick={() => startCall("audio")} className="p-2 h-9 w-9 flex items-center justify-center text-white/90 hover:text-white transition-colors rounded-full hover:bg-white/10" title="Voice Call">
                                    <Phone className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showAddMembers && (
                <AddGroupMembersDialog
                    conversationId={conversationId}
                    onClose={() => setShowAddMembers(false)}
                    onMembersAdded={() => setShowAddMembers(false)}
                />
            )}
        </div>
    );
}
