"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getApinatorClient } from "@/lib/apinator";
import { Send, Image as ImageIcon, Video, Phone, MoreVertical, X, Laugh, File as FileIcon, Search, UserPlus, Info, Trash2, Loader2, Paperclip, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FileUpload } from "@/components/ui/file-upload";
import { usePresence } from "@/components/providers/presence-provider";
import { formatLastSeen } from "@/lib/utils/presence";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-uploader";
import {
    encryptMessageAndSign,
    decryptMessageAndVerify,
    encryptFileBlob,
    keyStore
} from "@/lib/crypto/e2ee";
import { uploadToCatbox } from "@/lib/catbox";
import { EncryptedMedia } from "./encrypted-media";

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
    const { supabase } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [recipientLastSeen, setRecipientLastSeen] = useState<string | null>(null);
    const [recipientHideStatus, setRecipientHideStatus] = useState(false);
    const [recipientGhostUntil, setRecipientGhostUntil] = useState<string | null>(null);
    const { isUserOnline, isGhostModeActive } = usePresence();
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [isRecipientOnlineFromDB, setIsRecipientOnlineFromDB] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages();

        // Trigger read when user enters chat OR window is focused
        const handleFocus = () => {
            markMessagesAsRead();
        };

        window.addEventListener('focus', handleFocus);
        if (document.hasFocus()) markMessagesAsRead();

        // 📡 Apinator Real-time Subscription (replaces PeerJS)
        const client = getApinatorClient();
        if (!client) {
            console.warn("[ChatWindow] Apinator client not available! Real-time disabled.");
            return;
        }

        const channel = client.subscribe(`private-chat-${conversationId}`);

        const processAndDecryptMessage = async (msg: any) => {
            if (msg.sender_id === currentUserId) return msg;
            if (msg.iv && msg.signature && msg.encrypted_keys && msg.encrypted_keys[currentUserId]) {
                try {
                    const myEcdhPrivate = await keyStore.getKey("ecdh_private");
                    const myMlkemPrivate = await keyStore.getKey("mlkem_private") as unknown as Uint8Array | undefined;
                    let senderEcdsa = msg.sender?.ecdsa_public_key;
                    let senderEcdh = msg.sender?.ecdh_public_key;
                    if (!senderEcdsa || !senderEcdh) {
                        const { data: profile } = await supabase.from('profiles').select('ecdsa_public_key, ecdh_public_key, username, full_name, avatar_url').eq('id', msg.sender_id).single();
                        if (profile) {
                            senderEcdsa = profile.ecdsa_public_key;
                            senderEcdh = profile.ecdh_public_key;
                            msg.sender = profile;
                        }
                    }
                    if (myEcdhPrivate && senderEcdsa && senderEcdh) {
                        const decrypted = await decryptMessageAndVerify(
                            msg.content, msg.iv, msg.signature, msg.encrypted_keys[currentUserId],
                            senderEcdsa, senderEcdh, myEcdhPrivate, myMlkemPrivate
                        );
                        const parsed = JSON.parse(decrypted);
                        msg.content = parsed.text;
                        if (parsed.fileKeys) msg.e2e_file_keys = parsed.fileKeys;
                    }
                } catch (e) {
                    console.error("Live Decryption Error:", e);
                    msg.content = "🚫 [Secured / Tampered Message]";
                }
            }
            return msg;
        };

        channel.bind('new-message', async (data: any) => {
            let newMsg = typeof data === 'string' ? JSON.parse(data) : data;

            // Skip own messages (already added optimistically)
            if (newMsg.sender_id === currentUserId) return;

            // Track delivery gracefully (only for real UUIDs)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(newMsg.id);
            if (isUUID) {
                supabase.rpc('mark_message_delivered', { msg_id: newMsg.id }).then(() => {
                    fetch('/api/apinator/trigger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channel: `private-chat-${conversationId}`,
                            event: 'messages-delivered',
                            data: { reader_id: currentUserId, msg_id: newMsg.id }
                        })
                    }).catch(console.error);
                });
            }

            // Decrypt before adding to state
            newMsg = await processAndDecryptMessage(newMsg);

            setMessages((prev) => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            scrollToBottom();
            // Mark as read if receiving message while active
            if (newMsg.sender_id === recipientId) {
                markMessagesAsRead();
            }
        });

        channel.bind('message-confirmed', (data: any) => {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            setMessages(prev => {
                const existingMsg = prev.find(m => m.id === payload.tempId);
                let actualMsg = payload.actualMsg;
                if (existingMsg) {
                    // Preserve decrypted content & file keys so sender/receiver don't flash ciphertext
                    actualMsg.content = existingMsg.content;
                    actualMsg.e2e_file_keys = existingMsg.e2e_file_keys;
                }
                return prev.map(m => m.id === payload.tempId ? actualMsg : m);
            });
        });

        channel.bind('messages-read', (data: any) => {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            if (payload.reader_id === recipientId) {
                setMessages(prev => prev.map(m =>
                    m.sender_id === currentUserId && !m.is_read ? { ...m, is_read: true } : m
                ));
            }
        });

        channel.bind('messages-delivered', (data: any) => {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            if (payload.reader_id === recipientId) {
                setMessages(prev => prev.map(m => {
                    if (m.sender_id !== currentUserId || m.is_read || m.is_delivered) return m;
                    if (payload.msg_id && m.id !== payload.msg_id) return m;
                    return { ...m, is_delivered: true };
                }));
            }
        });

        console.log(`[ChatWindow] Subscribed to Apinator channel: private-chat-${conversationId}`);

        // Subscribe to recipient profile updates
        const profileChannel = supabase
            .channel(`profile-popup-${recipientId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${recipientId}` },
                (payload) => {
                    setRecipientLastSeen(payload.new.last_seen);
                    setIsRecipientOnlineFromDB(payload.new.is_online);
                    setRecipientHideStatus(payload.new.hide_online_status);
                    setRecipientGhostUntil(payload.new.ghost_mode_until);
                    // Force re-render for presence update
                    setMessages((prev: any[]) => [...prev]);
                }
            )
            .subscribe();

        // Initial check for is_online and privacy
        supabase.from('profiles').select('is_online, last_seen, hide_online_status, ghost_mode_until').eq('id', recipientId).single()
            .then(({ data }) => {
                if (data) {
                    setIsRecipientOnlineFromDB(data.is_online);
                    setRecipientLastSeen(data.last_seen);
                    setRecipientHideStatus(data.hide_online_status);
                    setRecipientGhostUntil(data.ghost_mode_until);
                }
            });

        return () => {
            window.removeEventListener('focus', handleFocus);
            if (client) client.unsubscribe(`private-chat-${conversationId}`);
            supabase.removeChannel(profileChannel);
        };
    }, [conversationId, recipientId, supabase]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const markMessagesAsRead = async () => {
        if (isGroup || isGhostModeActive) return;

        await supabase.rpc('mark_messages_as_read', { conv_id: conversationId });

        fetch('/api/apinator/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: `private-chat-${conversationId}`,
                event: 'messages-read',
                data: { reader_id: currentUserId }
            })
        }).catch(console.error);
    };

    const fetchMessages = async () => {
        setLoading(true);

        // Fetch recipient's last_seen if not a group
        if (!isGroup && recipientId) {
            supabase.from('profiles').select('last_seen').eq('id', recipientId).single()
                .then(({ data }) => {
                    if (data) setRecipientLastSeen(data.last_seen);
                });
        }

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
            // DECRYPTION LOGIC
            try {
                const myEcdhPrivate = await keyStore.getKey("ecdh_private");
                const myMlkemPrivate = await keyStore.getKey("mlkem_private") as unknown as Uint8Array | undefined;
                if (myEcdhPrivate) {
                    for (let i = 0; i < data.length; i++) {
                        const m = data[i];
                        if (m.iv && m.signature && m.encrypted_keys && m.encrypted_keys[currentUserId]) {
                            try {
                                const decryptedPayload = await decryptMessageAndVerify(
                                    m.content,
                                    m.iv,
                                    m.signature,
                                    m.encrypted_keys[currentUserId],
                                    m.sender.ecdsa_public_key,
                                    m.sender.ecdh_public_key,
                                    myEcdhPrivate,
                                    myMlkemPrivate
                                );
                                const payload = JSON.parse(decryptedPayload);
                                m.content = payload.text;
                                if (payload.fileKeys) {
                                    m.e2e_file_keys = payload.fileKeys;
                                }
                            } catch (decErr) {
                                console.error("Decryption failed for msg", m.id, decErr);
                                m.content = "🚫 [Secured / Tampered Message]";
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("E2E setup error during fetch", e);
            }

            setMessages(data);
            if (!isGroup) {
                // Batch mask as delivered
                supabase.rpc('mark_messages_delivered_in_conv', { conv_id: conversationId }).then(() => {
                    // Send apinator signal for batch delivery
                    fetch('/api/apinator/trigger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channel: `private-chat-${conversationId}`,
                            event: 'messages-delivered',
                            data: { reader_id: currentUserId }
                        })
                    }).catch(console.error);
                });
                
                // Mark as read after fetching (if not ghost)
                if (!isGhostModeActive) {
                    markMessagesAsRead();
                }
            }
        }
        setLoading(false);
    };

    const handleSend = async (fileData?: { urls: string[], thumb?: string, name?: string, fileBlob?: File }) => {
        if (!newMessage.trim() && !fileData) return;

        const msgContent = newMessage.trim();
        setNewMessage(""); // Optimistic clear
        setIsUploadingMedia(false);

        let mediaUrl = null;
        let fileKeysObj = null;

        if (fileData?.fileBlob) {
            setIsUploadingMedia(true);
            try {
                // If we get raw File object, we encrypt it for Catbox!
                const { encryptedBlob, fileKeyB64, fileIvB64 } = await encryptFileBlob(fileData.fileBlob);
                const encryptedFile = new File([encryptedBlob], "enc_" + fileData.fileBlob.name, { type: 'application/octet-stream' });
                mediaUrl = await uploadToCatbox(encryptedFile);
                fileKeysObj = {
                    key: fileKeyB64,
                    iv: fileIvB64,
                    name: fileData.fileBlob.name
                };
            } catch (e) {
                console.error("Encrypted Upload Failed", e);
                toast.error("Media Encryption ya Upload Fail ho gaya.");
                setIsUploadingMedia(false);
                return;
            }
            setIsUploadingMedia(false);
        } else if (fileData?.urls) {
            // Fallback to chunks
            mediaUrl = fileData.urls[0];
        }

        // ---------------- E2E ENCRYPTION ----------------
        const rawPayloadStr = JSON.stringify({
            text: msgContent || "",
            fileKeys: fileKeysObj
        });

        // Current participant fetching for encryption keys
        // (Assuming 1on1 for Window since Window doesn't have full group participants ref easily unless passed down)
        const participantIds = isGroup ? [recipientId, currentUserId] : [recipientId, currentUserId];

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, ecdh_public_key, ecdsa_public_key, mlkem_public_key')
            .in('id', participantIds);

        const recipientPublicKeys: Record<string, { ecdh: any, mlkem: string | null }> = {};
        profiles?.forEach(p => {
            if (p.ecdh_public_key) {
                recipientPublicKeys[p.id] = {
                    ecdh: JSON.parse(p.ecdh_public_key),
                    mlkem: p.mlkem_public_key || null
                };
            }
        });

        const myEcdsa = await keyStore.getKey("ecdsa_private");
        const myEcdh = await keyStore.getKey("ecdh_private");

        if (!myEcdsa || !myEcdh) {
            toast.error("Security Error: Device keys not found! Please re-login.");
            return;
        }

        const { encryptedContent, iv, signature, encryptedKeys } = await encryptMessageAndSign(
            rawPayloadStr,
            recipientPublicKeys,
            myEcdsa,
            myEcdh
        );

        const newPayload: any = {
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: encryptedContent,
            iv: iv,
            signature: signature,
            encrypted_keys: encryptedKeys,
            file_urls: mediaUrl ? [mediaUrl] : (fileData?.urls || []),
            thumbnail_url: fileData?.thumb || null,
            file_name: fileData?.name || null
        };
        // ------------------------------------------------

        const { data, error } = await supabase
            .from("messages")
            .insert(newPayload)
            .select(`
                *,
                sender:profiles!sender_id(username, full_name, avatar_url, ecdh_public_key, ecdsa_public_key),
                post:posts(*),
                story:stories(*)
            `)
            .single();

        if (error) {
            console.error("Failed to send", error);
            toast.error("Message send failed");
        } else if (data) {
            // Modify 'data' for local UI before adding to messages
            const uiMsg = {
                ...data,
                content: msgContent || "",
                e2e_file_keys: fileKeysObj
            };

            // Optimistic update for sender
            setMessages((prev) => [...prev, uiMsg]);
            scrollToBottom();

            // 📡 Broadcast via Apinator (replaces PeerJS)
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-chat-${conversationId}`,
                    event: 'new-message',
                    data: data // Send original DB record (ciphertext)
                })
            }).catch(console.error);

            // Notify sidebar for recipient
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-sidebar-${recipientId}`,
                    event: 'conversation-update',
                    data: { conversationId, lastMessage: data }
                })
            }).catch(console.error);
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

        // Fetch REAL caller profile (not hardcoded!)
        const { data: profile } = await supabase.from('profiles').select('full_name, username, avatar_url').eq('id', currentUserId).single();
        const callerName = profile?.full_name || profile?.username || "Someone";
        const callerAvatar = profile?.avatar_url || "https://github.com/shadcn.png";

        // Dispatch local call UI
        window.dispatchEvent(new CustomEvent('start-outgoing-call', {
            detail: { roomId: conversationId, remoteUserId: recipientId, callType: 'video' }
        }));

        // Send call notification via Apinator (UNLIMITED)
        fetch('/api/apinator/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: `private-call-${recipientId}`,
                event: 'incoming-call',
                data: {
                    roomId: conversationId,
                    callerId: currentUserId,
                    callerName,
                    callerAvatar,
                    callType: 'video',
                    isGroup: false
                }
            })
        }).catch(console.error);

        toast.success("Bula rahe hain...");
    };

    return (
        <div className="fixed bottom-4 right-4 w-80 h-96 bg-zinc-900 border border-white/20 rounded-t-xl shadow-2xl flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-primary/90 p-3 flex items-center justify-between text-white shadow-md">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Avatar className="h-8 w-8 border border-white/50">
                            <AvatarImage src={recipientAvatar} />
                            <AvatarFallback>{recipientName?.[0]}</AvatarFallback>
                        </Avatar>
                        {!isGroup && isUserOnline(recipientId) && !recipientHideStatus && (!recipientGhostUntil || new Date(recipientGhostUntil) < new Date()) && (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full" />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-sm truncate max-w-[120px]">{recipientName}</span>
                        <span className="text-[10px] text-white/70">
                            {isGroup ? "Group Chat" : ((recipientHideStatus || (recipientGhostUntil && new Date(recipientGhostUntil) > new Date())) ? "Last seen hidden" : (isUserOnline(recipientId) ? "Online" : formatLastSeen(recipientLastSeen)))}
                        </span>
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
                                            <EncryptedMedia
                                                urls={msg.file_urls}
                                                thumbnail={msg.thumbnail_url}
                                                fileName={msg.file_name}
                                                e2eKeys={msg.e2e_file_keys}
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

                                        {msg.content && (
                                            <span className={cn("leading-snug whitespace-pre-wrap flex-wrap break-all", msg.is_deleted && "italic opacity-70")}>
                                                {msg.content}
                                            </span>
                                        )}

                                        {/* Read Receipts (Ticks) for outgoing messages */}
                                        {isMe && !msg.content?.startsWith("[CALL_LOG]:") && (
                                            <div className="absolute right-0 -bottom-4 flex items-center gap-0.5">
                                                {msg.is_read ? (
                                                    <CheckCheck className="w-3.5 h-3.5 text-[#ff9933]" />
                                                ) : msg.is_delivered ? (
                                                    <CheckCheck className="w-3.5 h-3.5 text-zinc-500 opacity-70" />
                                                ) : (
                                                    <Check className="w-3.5 h-3.5 text-zinc-500 opacity-70" />
                                                )}
                                            </div>
                                        )}
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
