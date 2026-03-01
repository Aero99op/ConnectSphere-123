"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Send, ChevronLeft, Loader2, Video, Phone, MoreVertical, Image as ImageIcon, Users, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AddGroupMembersDialog } from "./add-group-members-dialog";

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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
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

                    // Always fetch sender details for realtime messages so UI doesn't break
                    // because the relational join isn't sent in the postgres_changes event
                    const { data } = await supabase.from('profiles').select('username, full_name, avatar_url').eq('id', newMsg.sender_id).single();
                    if (data) {
                        newMsg.sender = data;
                    }

                    if (isMounted) {
                        setMessages((prev) => [...prev, newMsg]);
                        scrollToBottom();
                    }
                }
            )
            .subscribe((status: string, err: any) => {
                if (err) console.error("ChatView subscribe error:", err);
            });

        return () => {
            isMounted = false;
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

    const startCall = async (type: "video" | "audio") => {
        if (isGroup) {
            toast.info("Mandli me call jald hi aayega!");
            return;
        }

        if (!recipientId) {
            toast.error("Cannot call unknown user");
            return;
        }

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
        const callerName = profile?.full_name || profile?.username || "Someone";
        const callerAvatar = profile?.avatar_url || "https://github.com/shadcn.png";

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
                    callType: type
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
                            <span className="text-[11px] text-zinc-400 font-medium">Active now</span>
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
                                                <div className="flex items-center gap-3 font-medium cursor-default px-1 py-0.5">
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
                                            <span className="leading-snug whitespace-pre-wrap flex-wrap break-all">{msg.content}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area - Instagram Style Pill */}
            <div className="p-3 bg-black/95 backdrop-blur-xl border-t border-white/5 shrink-0 w-full pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto flex items-center gap-2 bg-[#121212] border border-white/10 rounded-[30px] p-1 pr-2 shadow-inner">
                    <button className="p-2.5 h-10 w-10 flex items-center justify-center text-white/90 hover:text-white transition-all hover:bg-white/5 rounded-full shrink-0" title="Attach Image">
                        <ImageIcon className="w-5.5 h-5.5" />
                    </button>
                    <div className="flex-1">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Message..."
                            className="w-full bg-transparent border-none py-2.5 px-1 text-[15px] text-white focus:outline-none focus:ring-0 resize-none custom-scrollbar min-h-[42px] max-h-[120px] placeholder:text-zinc-500 leading-[1.2]"
                            rows={1}
                            style={{ height: Math.min(120, Math.max(42, newMessage.split('\n').length * 20 + 20)) }}
                        />
                    </div>
                    {newMessage.trim() ? (
                        <button
                            onClick={handleSend}
                            className="text-orange-500 hover:text-orange-400 font-bold text-[15px] px-3 py-1 transition-all active:scale-95 shrink-0"
                        >
                            Send
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 pr-1">
                            {/* Placeholder icons for IG feel */}
                            <button onClick={() => startCall("video")} className="p-2 text-white/90 hover:text-white transition-colors" title="Video Call">
                                <Video className="w-5 h-5" />
                            </button>
                            <button onClick={() => startCall("audio")} className="p-2 text-white/90 hover:text-white transition-colors" title="Voice Call">
                                <Phone className="w-5 h-5" />
                            </button>
                        </div>
                    )}
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
