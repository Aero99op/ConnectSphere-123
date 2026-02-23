"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Send, X, Loader2, Video, Paperclip, FileIcon, ImageIcon, Camera } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FileUpload } from "@/components/ui/file-upload";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-downloader";

interface ChatWindowProps {
    conversationId: string;
    recipientName: string;
    recipientAvatar?: string;
    recipientId: string;
    isGroup?: boolean;
    onClose: () => void;
    currentUserId: string;
}

export function ChatWindow({ conversationId, recipientName, recipientAvatar, recipientId, isGroup, onClose, currentUserId }: ChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages();

        // Realtime Subscription
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
                    // Fetch sender details for the new message if it's a group chat
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
        // Helper: 'sender:sender_id(...)' might fail if relationship mapping isn't auto-detected.
        // Using 'profiles!sender_id' is safer if FK is explicit.
        // Let's try select `*, sender:profiles!sender_id(...)`
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

    const handleSend = async (fileData?: { urls: string[], thumb?: string, name?: string }) => {
        if (!newMessage.trim() && !fileData) return;

        const msgContent = newMessage.trim();
        setNewMessage(""); // Optimistic clear
        setIsUploadingMedia(false);

        const { error } = await supabase
            .from("messages")
            .insert({
                conversation_id: conversationId,
                sender_id: currentUserId,
                content: msgContent || null,
                file_urls: fileData?.urls || [],
                thumbnail_url: fileData?.thumb || null,
                file_name: fileData?.name || null
            });

        if (error) {
            console.error("Failed to send", error);
            toast.error("Message send failed");
        }
    };

    const handleFileUploadComplete = (urls: string[], thumb?: string) => {
        handleSend({ urls, thumb, name: "Media Attachment" });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startVideoCall = async () => {
        if (isGroup) {
            toast.info("Group video calls coming soon!");
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

        toast.success("Calling...");
    };

    return (
        <div className="fixed bottom-4 right-4 w-80 h-96 bg-zinc-900 border border-white/20 rounded-t-xl shadow-2xl flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-primary/90 p-3 flex items-center justify-between text-white shadow-md">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 border border-white/50">
                        <AvatarImage src={recipientAvatar} />
                        <AvatarFallback>{recipientName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold text-sm truncate max-w-[120px]">{recipientName}</span>
                        {isGroup && <span className="text-[10px] text-white/70">Group Chat</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={startVideoCall} className="hover:bg-white/20 p-2 rounded-full text-white transition-colors" title="Video Call">
                        <Video className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-black/95">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-zinc-500 mt-10">
                        {isGroup ? "Start the conversation!" : "No messages yet. Say Hi! 👋"}
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === currentUserId;
                        // For received messages in groups, show sender info
                        const showSender = isGroup && !isMe;

                        return (
                            <div key={msg.id} className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
                                {showSender && (
                                    <span className="text-[10px] text-zinc-500 ml-2">
                                        {msg.sender?.full_name || msg.sender?.username || "Unknown"}
                                    </span>
                                )}
                                <div className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                                    {showSender && (
                                        <Avatar className="w-6 h-6 mb-1">
                                            <AvatarImage src={msg.sender?.avatar_url} />
                                            <AvatarFallback>{msg.sender?.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div className={cn(
                                        "max-w-[75%] px-3 py-2 rounded-lg text-sm break-words flex flex-col gap-2",
                                        isMe ? "bg-primary text-white rounded-br-none" : "bg-zinc-800 text-zinc-200 rounded-bl-none"
                                    )}>
                                        {/* Chunked Media Rendering */}
                                        {msg.file_urls && msg.file_urls.length > 0 && (
                                            <ChatMediaBubble
                                                urls={msg.file_urls}
                                                thumbnail={msg.thumbnail_url}
                                                name={msg.file_name}
                                            />
                                        )}

                                        {/* Shared Post Preview */}
                                        {msg.post && (
                                            <div className="rounded-md overflow-hidden border border-white/20 bg-black cursor-pointer hover:opacity-80 transition-opacity">
                                                <img
                                                    src={msg.post.thumbnail_url || msg.post.file_urls?.[0]}
                                                    alt="Shared Post"
                                                    className="w-full h-32 object-cover"
                                                />
                                                <div className="p-1 px-2 text-[10px] bg-black/50 text-white/80 truncate">
                                                    Post: {msg.post.caption || "No Caption"}
                                                </div>
                                            </div>
                                        )}

                                        {/* Shared Story Preview */}
                                        {msg.story && (
                                            <div className="rounded-md overflow-hidden border border-white/20 bg-black w-32 cursor-pointer hover:opacity-80 transition-opacity">
                                                <img
                                                    src={msg.story.media_url}
                                                    alt="Shared Story"
                                                    className="w-full h-48 object-cover"
                                                />
                                                <div className="p-1 px-2 text-[10px] bg-black/50 text-white/80">
                                                    Shared Story
                                                </div>
                                            </div>
                                        )}

                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Media Upload Overlay */}
            {isUploadingMedia && (
                <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                    <button
                        onClick={() => setIsUploadingMedia(false)}
                        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                    <FileUpload onUploadComplete={handleFileUploadComplete} maxSizeMB={500} />
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-zinc-900 border-t border-white/10 flex items-center gap-2">
                <button
                    onClick={() => setIsUploadingMedia(true)}
                    className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-primary transition-colors"
                >
                    <Paperclip className="w-5 h-5" />
                </button>
                <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 bg-black border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
                <button
                    onClick={() => handleSend()}
                    disabled={!newMessage.trim()}
                    className="bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-full text-white transition-colors"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// Sub-component for rendering chunked media in Chat
function ChatMediaBubble({ urls, thumbnail, name }: { urls: string[], thumbnail?: string, name?: string }) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        if (blobUrl) return;
        setLoading(true);
        try {
            const url = await downloadAndMergeChunks(urls, 'application/octet-stream');
            setBlobUrl(url);
        } catch (e) {
            toast.error("File download fail ho gaya!");
        } finally {
            setLoading(false);
        }
    };

    // If it's a small image (just 1 chunk usually) or has a thumbnail, show preview
    const isSingleImage = urls.length === 1 && !thumbnail;

    return (
        <div className="group relative rounded-lg overflow-hidden border border-white/10 bg-black/40 min-w-[200px]">
            {thumbnail || isSingleImage ? (
                <div className="relative aspect-video">
                    <img
                        src={thumbnail || urls[0]}
                        className="w-full h-full object-cover"
                        alt="Media Preview"
                    />
                    {urls.length > 1 && !blobUrl && (
                        <button
                            onClick={handleDownload}
                            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">📥 Load Full Quality</div>}
                        </button>
                    )}
                </div>
            ) : (
                <div className="p-3 flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg">
                        <FileIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-white">{name || "Media File"}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">{urls.length} Chunks</p>
                    </div>
                    {!blobUrl ? (
                        <button onClick={handleDownload} disabled={loading} className="text-zinc-400 hover:text-white">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Download</span>}
                        </button>
                    ) : (
                        <a href={blobUrl} download={name || "file"} className="text-primary text-xs font-bold">Open</a>
                    )}
                </div>
            )}

            {blobUrl && (thumbnail || isSingleImage) && (
                <div className="p-2 border-t border-white/5 flex justify-end">
                    <a href={blobUrl} download={name || "media"} className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        Download Original
                    </a>
                </div>
            )}
        </div>
    );
}
