"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Send, ChevronLeft, Loader2, Video, Phone, MoreVertical, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages();

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
                async (payload) => {
                    const newMsg = payload.new;
                    if (isGroup) {
                        const { data } = await supabase.from('profiles').select('username, full_name, avatar_url').eq('id', newMsg.sender_id).single();
                        if (data) newMsg.sender = data;
                    }
                    setMessages((prev) => [...prev, newMsg]);
                    scrollToBottom();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                post:posts(id, file_urls, thumbnail_url, media_type, caption),
                story:stories(id, media_url, media_type)
            `)
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

        if (!error && data) {
            setMessages(data);
        }
        setLoading(false);
    };

    const handleSend = async () => {
        if (!newMessage.trim()) return;

        const msgContent = newMessage.trim();
        setNewMessage("");

        const { error } = await supabase
            .from("messages")
            .insert({
                conversation_id: conversationId,
                sender_id: currentUserId,
                content: msgContent
            });

        if (error) {
            console.error("Failed to send", error);
            toast.error("Sandesh bhej nahi paye");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startVideoCall = async () => {
        if (isGroup) {
            toast.info("Mandli me video call jald hi aayega!");
            return;
        }

        if (!recipientId) {
            toast.error("Cannot call unknown user");
            return;
        }

        const channel = supabase.channel(`user:${recipientId}`);
        await channel.send({
            type: "broadcast",
            event: "incoming-call",
            payload: {
                roomId: conversationId,
                callerId: currentUserId,
                callerName: "You",
                callerAvatar: "https://github.com/shadcn.png"
            }
        });

        toast.success("Bula rahe hain...");
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0a] relative">
            {/* Header */}
            <div className="h-16 px-4 bg-black/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between sticky top-0 z-10 w-full shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 text-white transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <Avatar className="h-10 w-10 border border-white/20">
                        <AvatarImage src={recipientAvatar} />
                        <AvatarFallback>{recipientName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold text-[15px] leading-tight text-white">{recipientName}</span>
                        {isGroup ? (
                            <span className="text-[11px] text-zinc-400">Mandli</span>
                        ) : (
                            <span className="text-[11px] text-green-500 font-medium">Active now</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-2.5 hover:bg-white/10 rounded-full text-zinc-300 transition-colors" title="Voice Call">
                        <Phone className="w-5 h-5" />
                    </button>
                    <button onClick={startVideoCall} className="p-2.5 hover:bg-white/10 rounded-full text-zinc-300 transition-colors" title="Video Call">
                        <Video className="w-5 h-5" />
                    </button>
                    <button className="p-2.5 hover:bg-white/10 rounded-full text-zinc-300 transition-colors hidden md:block" title="More Info">
                        <MoreVertical className="w-5 h-5" />
                    </button>
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
                    messages.map((msg, index) => {
                        const isMe = msg.sender_id === currentUserId;
                        const showSender = isGroup && !isMe;
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        const showAvatar = showSender && (!prevMsg || prevMsg.sender_id !== msg.sender_id);

                        return (
                            <div key={msg.id} className={cn("flex flex-col gap-1 w-full", isMe ? "items-end" : "items-start")}>
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
                                        "px-4 py-2.5 rounded-2xl text-[15px] break-words flex flex-col gap-2 relative shadow-sm",
                                        isMe ? "bg-gradient-to-br from-orange-600 to-orange-500 text-white rounded-br-sm"
                                            : "bg-zinc-800/90 text-zinc-100 rounded-bl-sm border border-white/5"
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

                                        <span className="leading-snug">{msg.content}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-black/90 backdrop-blur-xl border-t border-white/10 shrink-0 w-full">
                <div className="max-w-4xl mx-auto flex gap-2 items-end">
                    <button className="p-3 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10 shrink-0" title="Attach Image">
                        <ImageIcon className="w-6 h-6" />
                    </button>
                    <div className="flex-1 relative">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Kuch sandesh likhein..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 min-h-[48px] max-h-[120px] text-sm text-white focus:outline-none focus:border-white/30 resize-none custom-scrollbar"
                            rows={1}
                            style={{ height: newMessage.split('\n').length * 24 + 24 }}
                        />
                    </div>
                    {newMessage.trim() ? (
                        <button
                            onClick={handleSend}
                            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-full text-white transition-all transform active:scale-95 shrink-0 shadow-lg"
                        >
                            <Send className="w-5 h-5 ml-1" />
                        </button>
                    ) : (
                        <button className="p-3 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10 shrink-0">
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
