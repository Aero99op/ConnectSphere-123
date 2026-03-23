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
import { useTheme } from "next-themes";
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
    
    // Refs for optimization
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastScrollHeight = useRef<number>(0);
    const [sendReadReceipts, setSendReadReceipts] = useState<boolean>(true);

    useEffect(() => {
        fetchMessages();

        // Trigger read when user enters chat OR window is focused
        const handleFocus = () => {
            markMessagesAsRead();
        };

        window.addEventListener('focus', handleFocus);
        if (document.hasFocus()) markMessagesAsRead();

        // 📡 Apinator Real-time Subscription (Self-Healing)
        const channelName = `private-chat-${conversationId}`;
        const ensureSubscription = () => {
            const client = getApinatorClient();
            if (!client || client.state === 'failed' || client.state === 'unavailable') return false;
            
            const ch = client.subscribe(channelName);
            ch.unbind('new-message');
            ch.bind('new-message', async (data: any) => {
                let newMsg = typeof data === 'string' ? JSON.parse(data) : data;
                if (newMsg.sender_id === currentUserId) return;
                
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(newMsg.id);
                if (isUUID) {
                    await supabase.rpc('mark_message_delivered', { msg_id: newMsg.id });
                    fetch('/api/apinator/trigger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channel: `private-chat-${conversationId}`,
                            event: 'messages-delivered',
                            data: { reader_id: currentUserId, msg_id: newMsg.id }
                        })
                    }).catch(() => {});
                }
                
                const decrypted = await processAndDecryptMessage(newMsg);
                setMessages(prev => [...prev, decrypted]);
                scrollToBottom();
                if (document.hasFocus()) markMessagesAsRead();
            });

            ch.unbind('messages-delivered');
            ch.bind('messages-delivered', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (payload.reader_id === recipientId) {
                    setMessages(prev => prev.map(m => {
                        if (m.sender_id !== currentUserId || m.is_read || m.is_delivered) return m;
                        if (payload.msg_id && m.id !== payload.msg_id) return m;
                        return { ...m, is_delivered: true };
                    }));
                }
            });

            ch.unbind('message-updated');
            ch.bind('message-updated', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                setMessages(prev => prev.map(m => m.id === payload.tempId ? payload.actualMsg : m));
            });

            ch.unbind('messages-read');
            ch.bind('messages-read', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (payload.reader_id === recipientId) {
                    setMessages(prev => prev.map(m =>
                        m.sender_id === currentUserId && !m.is_read ? { ...m, is_read: true } : m
                    ));
                }
            });

            return true;
        };

        const client = getApinatorClient();
        if (client) {
            ensureSubscription();
            client.bind('state_change', (states: any) => {
                if (states.current === 'connected') ensureSubscription();
            });
        }

        const processAndDecryptMessage = async (msg: any) => {
            if (msg.sender_id === currentUserId) return msg;
            if (msg.iv && msg.signature && msg.encrypted_keys && msg.encrypted_keys[currentUserId]) {
                try {
                    const myEcdhPrivate = await keyStore.getKey("ecdh_private") as CryptoKey | undefined;
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
                    msg.content = "🔒 [Encrypted message — keys changed]";
                }
            }
            return msg;
        };

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
        supabase.from('profiles').select('is_online, last_seen').eq('id', recipientId).single()
            .then(({ data }) => {
                if (data) {
                    setIsRecipientOnlineFromDB(data.is_online);
                    setRecipientLastSeen(data.last_seen);
                }
            });
            
        // Fetch recipient privacy from Supabase directly (chat/settings API is now self-only)
        const fetchRecipientPrivacy = async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('hide_online_status, ghost_mode_until, send_read_receipts')
                    .eq('id', recipientId)
                    .single();
                    
                if (data) {
                    setRecipientHideStatus(data.hide_online_status || false);
                    setRecipientGhostUntil(data.ghost_mode_until || null);
                    if (data.send_read_receipts === false) setSendReadReceipts(false);
                }
            } catch (err) {
                console.error("Recipient privacy fetch failed:", err);
            }
        };
        fetchRecipientPrivacy();

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
                sender:profiles!sender_id(username, full_name, avatar_url, ecdh_public_key, ecdsa_public_key),
                post:posts(*),
                story:stories(*)
            `)
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

        if (!error && data) {
            // DECRYPTION LOGIC
            try {
                const myEcdhPrivate = await keyStore.getKey("ecdh_private") as CryptoKey | undefined;
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
                                m.content = "🔒 [Encrypted message — keys changed]";
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

        const myEcdsa = await keyStore.getKey("ecdsa_private") as CryptoKey | undefined;
        const myEcdh = await keyStore.getKey("ecdh_private") as CryptoKey | undefined;

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

            // Send Background Push Notification (Payload-less Ping)
            fetch('/api/push/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId })
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

    // E2EE Setup (Key Store Check)
    useEffect(() => {
        let isMounted = true;
        
        // Check my read receipt preference (session-based, no userId needed)
        fetch(`/api/chat/settings`).then(r => r.json()).then(data => {
            if (data && isMounted) setSendReadReceipts(data.send_read_receipts !== false);
        }).catch(console.error);

        const checkKeys = async () => {
            const ecdsa = await keyStore.getKey("ecdsa_private") as CryptoKey | undefined;
            const ecdh = await keyStore.getKey("ecdh_private") as CryptoKey | undefined;
            if (!ecdsa || !ecdh) {
                toast.error("Security Error: Device keys not found! Please re-login.");
            }
        };
        checkKeys();

        return () => {
            isMounted = false;
        };
    }, [currentUserId, supabase]);

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

    const { theme } = useTheme();

    return (
        <div className={cn(
            "fixed bottom-4 right-4 w-80 h-96 flex flex-col z-50 overflow-hidden transition-all duration-500",
            theme === 'radiant-void' 
                ? "bg-black border border-white/10 rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
                : "bg-zinc-900 border border-white/20 rounded-t-xl shadow-2xl"
        )}>
            {/* Header */}
            <div className={cn(
                "p-3 flex items-center justify-between shadow-md relative overflow-hidden",
                theme === 'radiant-void' 
                    ? "bg-black/40 backdrop-blur-md border-b border-white/5" 
                    : "bg-primary/90 text-white"
            )}>
                {/* Header Glow for Radiant Void */}
                {theme === 'radiant-void' && (
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                )}

                <div className="flex items-center gap-2 relative z-10">
                    <div className="relative">
                        <Avatar className={cn(
                            "h-8 w-8",
                            theme === 'radiant-void' ? "rounded-lg border-white/10" : "border border-white/50"
                        )}>
                            <AvatarImage src={recipientAvatar} />
                            <AvatarFallback>{recipientName?.[0]}</AvatarFallback>
                        </Avatar>
                        {!isGroup && isUserOnline(recipientId) && !recipientHideStatus && (!recipientGhostUntil || new Date(recipientGhostUntil) < new Date()) && (
                            <div className={cn(
                                "absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-black rounded-full",
                                theme === 'radiant-void' ? "bg-accent" : "bg-green-500"
                            )} />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className={cn(
                            "font-semibold text-sm truncate max-w-[120px]",
                            theme === 'radiant-void' ? "text-white uppercase tracking-tight" : "text-white"
                        )}>{recipientName}</span>
                        <span className={cn(
                            "text-[10px]",
                            theme === 'radiant-void' ? "text-primary italic font-medium" : "text-white/70"
                        )}>
                            {isGroup ? "Group Chat" : ((recipientHideStatus || (recipientGhostUntil && new Date(recipientGhostUntil) > new Date())) ? "Last seen hidden" : (isUserOnline(recipientId) ? "Online" : formatLastSeen(recipientLastSeen)))}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1 relative z-10">
                    <button onClick={startVideoCall} className="hover:bg-white/10 p-2 rounded-full transition-colors group" title="Video Call">
                        <Video className={cn("w-4 h-4", theme === 'radiant-void' ? "text-zinc-400 group-hover:text-primary" : "text-white")} />
                    </button>
                    <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors group">
                        <X className={cn("w-4 h-4", theme === 'radiant-void' ? "text-zinc-400 group-hover:text-rose-500" : "text-white")} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className={cn(
                "flex-1 p-4 overflow-y-auto space-y-4 no-scrollbar",
                theme === 'radiant-void' ? "bg-black" : "bg-black/95"
            )}>
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
                            <div key={msg.id} className={cn("flex flex-col gap-1.5", isMe ? "items-end" : "items-start")}>
                                {showSender && (
                                    <span className="text-[10px] text-zinc-500 ml-2 font-mono uppercase tracking-widest">
                                        {msg.sender?.full_name || msg.sender?.username || "Unknown"}
                                    </span>
                                )}
                                <div className={cn("flex items-end gap-2 max-w-[85%]", isMe ? "flex-row-reverse" : "flex-row")}>
                                    {showSender && (
                                        <Avatar className="w-6 h-6 mb-1 rounded-sm overflow-hidden">
                                            <AvatarImage src={msg.sender?.avatar_url} />
                                            <AvatarFallback className="text-[8px]">{msg.sender?.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div className={cn(
                                        "px-3 py-2 text-[13px] break-words flex flex-col gap-2 relative transition-all duration-300",
                                        isMe 
                                            ? (theme === 'radiant-void' 
                                                ? "bg-primary/20 text-white rounded-[12px] border border-primary/20 shadow-[0_0_20px_rgba(255,141,135,0.1)]" 
                                                : "bg-primary text-white rounded-lg rounded-br-none shadow-md")
                                            : (theme === 'radiant-void' 
                                                ? "bg-zinc-900/50 text-zinc-300 rounded-[12px] border border-white/5" 
                                                : "bg-zinc-800 text-zinc-200 rounded-lg rounded-bl-none shadow-sm")
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
                                            <span className={cn(
                                                "leading-snug flex-wrap break-all", 
                                                msg.is_deleted && "italic opacity-70",
                                                theme === 'radiant-void' && !isMe && "font-serif italic"
                                            )}>
                                                {msg.content}
                                            </span>
                                        )}
                                        {/* Read Receipts (Ticks) for outgoing messages */}
                                        {isMe && !msg.content?.startsWith("[CALL_LOG]:") && (
                                            <div className="absolute right-1 -bottom-5 flex items-center gap-0.5">
                                                {msg.is_read && sendReadReceipts ? (
                                                    <CheckCheck className={cn("w-3.5 h-3.5", theme === 'radiant-void' ? "text-primary" : "text-[#ff9933]")} />
                                                ) : (msg.is_delivered || msg.is_read) ? (
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
                <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300 backdrop-blur-sm">
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
            <div className={cn(
                "p-3 flex items-center gap-2 transition-all duration-500",
                theme === 'radiant-void' ? "bg-black border-t border-white/5" : "bg-zinc-900 border-t border-white/10"
            )}>
                <button
                    onClick={() => setIsUploadingMedia(true)}
                    className={cn(
                        "p-2 rounded-full transition-colors",
                        theme === 'radiant-void' ? "hover:bg-primary/10 text-zinc-500 hover:text-primary" : "hover:bg-white/5 text-zinc-400 hover:text-primary"
                    )}
                >
                    <Paperclip className="w-5 h-5" />
                </button>
                <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Premium baat cheet karein..."
                    className={cn(
                        "flex-1 px-4 py-2 text-sm focus:outline-none transition-all",
                        theme === 'radiant-void' 
                            ? "bg-zinc-900/50 border border-white/5 rounded-lg text-white focus:border-primary/50" 
                            : "bg-black border border-white/10 rounded-full text-white focus:border-primary"
                    )}
                />
                <button
                    onClick={() => handleSend()}
                    disabled={!newMessage.trim()}
                    className={cn(
                        "disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-full text-white transition-all transform active:scale-90",
                        theme === 'radiant-void' 
                            ? "bg-primary shadow-[0_0_15px_rgba(255,141,135,0.3)] hover:shadow-primary/50" 
                            : "bg-primary hover:bg-primary/80"
                    )}
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
