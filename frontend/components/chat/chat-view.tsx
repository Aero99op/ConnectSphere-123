"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { uploadToCatbox } from "@/lib/catbox";
import { getApinatorClient } from "@/lib/apinator";
import { Send, ChevronLeft, Loader2, Video, Phone, MoreVertical, Image as ImageIcon, Users, LogOut, Check, CheckCheck, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usePresence } from "@/components/providers/presence-provider";
import { formatLastSeen } from "@/lib/utils/presence";
import { AddGroupMembersDialog } from "./add-group-members-dialog";
import Image from "next/image";
import { 
    encryptMessageAndSign, 
    decryptMessageAndVerify, 
    encryptFileBlob, 
    keyStore 
} from "@/lib/crypto/e2ee";
import { EncryptedMedia } from "./encrypted-media";


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
    const { supabase } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [recipientLastSeen, setRecipientLastSeen] = useState<string | null>(null);
    const [recipientHideStatus, setRecipientHideStatus] = useState(false);
    const [recipientGhostUntil, setRecipientGhostUntil] = useState<string | null>(null);
    const { isUserOnline, isGhostModeActive } = usePresence();
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [isRecipientOnlineFromDB, setIsRecipientOnlineFromDB] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map()); // userId -> timestamp
    const [messageContextMenuId, setMessageContextMenuId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showStickers, setShowStickers] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingSignalRef = useRef<number>(0);
    const groupParticipantsRef = useRef<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [sendReadReceipts, setSendReadReceipts] = useState<boolean>(true);

    // Apinator-based Realtime Chat (UNLIMITED connections)
    useEffect(() => {
        let isMounted = true;
        
        // Check my read receipt preference
        supabase.from('profiles').select('send_read_receipts').eq('id', currentUserId).single().then(({data}) => {
            if (data && isMounted) setSendReadReceipts(data.send_read_receipts !== false);
        });

        fetchMessages();

        // Trigger read when user enters chat OR window is focused
        const handleFocus = () => {
            if (isMounted) markMessagesAsRead();
        };

        window.addEventListener('focus', handleFocus);
        if (document.hasFocus()) markMessagesAsRead();

        const setupSubscription = () => {
            const client = getApinatorClient();
            if (!client) return null;

            const chatChannelName = `private-chat-${conversationId}`;
            const channel = client.subscribe(chatChannelName);

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

            // Track delivery safely
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

            // Decrypt before setting state
            newMsg = await processAndDecryptMessage(newMsg);

            setMessages((prev) => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });

            if (isMounted) {
                // Mark as read if receiving a message while active
                if (newMsg.sender_id === recipientId) {
                    markMessagesAsRead();
                }
            }

            if (newMsg.sender_id !== currentUserId && !newMsg.sender) {
                supabase.from('profiles').select('username, full_name, avatar_url').eq('id', newMsg.sender_id).single().then(({ data: senderProfile }) => {
                    if (senderProfile && isMounted) {
                        setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, sender: senderProfile } : m));
                    }
                });
            }
        });
            channel.bind('message-confirmed', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (isMounted) {
                    setMessages(prev => {
                        const existingMsg = prev.find(m => m.id === payload.tempId);
                        let actualMsg = payload.actualMsg;
                        if (existingMsg) {
                            actualMsg.content = existingMsg.content;
                            actualMsg.e2e_file_keys = existingMsg.e2e_file_keys;
                        }
                        const newArray = prev.map(m => m.id === payload.tempId ? actualMsg : m);
                        return newArray.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    });
                }
            });

            channel.bind('messages-read', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (isMounted && payload.reader_id === recipientId) {
                    setMessages(prev => prev.map(m =>
                        m.sender_id === currentUserId && !m.is_read ? { ...m, is_read: true } : m
                    ));
                }
            });

            channel.bind('messages-delivered', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (isMounted && payload.reader_id === recipientId) {
                    setMessages(prev => prev.map(m => {
                        if (m.sender_id !== currentUserId || m.is_read || m.is_delivered) return m;
                        if (payload.msg_id && m.id !== payload.msg_id) return m;
                        return { ...m, is_delivered: true };
                    }));
                }
            });

            channel.bind('update-message', (data: any) => {
                const updatedMsg = typeof data === 'string' ? JSON.parse(data) : data;
                if (isMounted) {
                    setMessages((prev) => {
                        const newArray = prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m);
                        return newArray.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    });
                }
            });

            channel.bind('typing', (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                if (payload.userId !== currentUserId && isMounted) {
                    setTypingUsers(prev => {
                        const next = new Map(prev);
                        if (payload.isTyping) next.set(payload.userId, Date.now());
                        else next.delete(payload.userId);
                        return next;
                    });
                }
            });

            // SELF-HEALING: Re-subscribe if connection recovers
            const handleStateChange = (states: any) => {
                if (states.current === 'connected' && isMounted) {
                    const existing = client.channel(chatChannelName);
                    if (!existing || !existing.subscribed) {
                        console.log("[ChatView] 🔄 Re-subscribing after reconnect...");
                        client.subscribe(chatChannelName);
                        // Events are already bound to the client/channel object usually, 
                        // but re-subscribing ensures the server knows we are back.
                    }
                    fetchMessages();
                }
            };
            client.bind('state_change', handleStateChange);
            (channel as any)._stateChangeHandler = handleStateChange; // Store for cleanup

            console.log(`[ChatView] Subscribed to Apinator channel: private-chat-${conversationId}`);
            return channel;
        };

        let currentChannel = setupSubscription();

        // Cleanup expired typing indicators every 3 seconds
        const typingCleanupInterval = setInterval(() => {
            if (!isMounted) return;
            const now = Date.now();
            setTypingUsers(prev => {
                let changed = false;
                const next = new Map(prev);
                Array.from(next.entries()).forEach(([uid, timestamp]) => {
                    if (now - timestamp > 4000) {
                        next.delete(uid);
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 3000);

        if (isGroup) {
            supabase.from('conversation_participants').select('user_id').eq('conversation_id', conversationId)
                .then(({ data }) => {
                    if (data) groupParticipantsRef.current = data.map(p => p.user_id);
                });
        } else {
            // Subscribe to recipient profile updates
            const profileChannel = supabase
                .channel(`profile-${recipientId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${recipientId}` },
                    (payload) => {
                        if (isMounted) {
                            setRecipientLastSeen(payload.new.last_seen);
                            setIsRecipientOnlineFromDB(payload.new.is_online);
                            setRecipientHideStatus(payload.new.hide_online_status);
                            setRecipientGhostUntil(payload.new.ghost_mode_until);
                            // Force re-render
                            setMessages((prev: any[]) => [...prev]);
                        }
                    }
                )
                .subscribe();

            return () => {
                isMounted = false;
                clearInterval(typingCleanupInterval);
                const c = getApinatorClient();
                if (c) {
                    if (currentChannel && (currentChannel as any)._stateChangeHandler) {
                        c.unbind('state_change', (currentChannel as any)._stateChangeHandler);
                    }
                    c.unsubscribe(`private-chat-${conversationId}`);
                }
                supabase.removeChannel(profileChannel);
            };
        }

        return () => {
            isMounted = false;
            clearInterval(typingCleanupInterval);
            const c = getApinatorClient();
            if (c) {
                if (currentChannel && (currentChannel as any)._stateChangeHandler) {
                    c.unbind('state_change', (currentChannel as any)._stateChangeHandler);
                }
                c.unsubscribe(`private-chat-${conversationId}`);
            }
        };
    }, [conversationId, isGroup]);

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
                    if (msgId && !isGhostModeActive) { // Suppress read receipt in ghost mode
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
        // Skip temporary optimistic IDs (they are not UUIDs)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(msgId);
        if (!isUUID) return;

        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: true } : m));

        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', msgId);

        if (!error && !isGhostModeActive) { // also send real-time event when marking specific msg
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-chat-${conversationId}`,
                    event: 'messages-read',
                    data: { reader_id: currentUserId }
                })
            }).catch(console.error);
        }
        if (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMessages = async () => {
        setLoading(true);

        // Fetch recipient's last_seen if not a group
        if (!isGroup && recipientId) {
            supabase.from('profiles').select('is_online, last_seen, hide_online_status, ghost_mode_until').eq('id', recipientId).single()
                .then(({ data }) => {
                    if (data) {
                        setRecipientLastSeen(data.last_seen);
                        setIsRecipientOnlineFromDB(data.is_online);
                        setRecipientHideStatus(data.hide_online_status);
                        setRecipientGhostUntil(data.ghost_mode_until);
                    }
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
                                // Parse the E2E JSON payload
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
                supabase.rpc('mark_messages_delivered_in_conv', { conv_id: conversationId }).then();
                // Mark as read after fetching (if not ghost)
                if (!isGhostModeActive) {
                    supabase.rpc('mark_messages_as_read', { conv_id: conversationId }).then();
                }
            }
        }
        setLoading(false);
    };

    const markMessagesAsRead = async () => {
        if (isGroup || isGhostModeActive) return;

        // 1. Update DB
        const { error } = await supabase.rpc('mark_messages_as_read', { conv_id: conversationId });
        if (error) console.error("Failed to mark as read", error);

        // 2. Trigger Apinator event for real-time
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
        const msgContent = newMessage.trim();
        if (!msgContent && !selectedMedia) return;

        // Instant typing clear for other clients
        fetch('/api/apinator/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: `private-chat-${conversationId}`,
                event: 'typing',
                data: { userId: currentUserId, isTyping: false }
            })
        }).catch(console.error);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        lastTypingSignalRef.current = 0;

        if (editingMessageId && !selectedMedia) {
            setNewMessage("");
            const { error } = await supabase
                .from("messages")
                .update({ content: msgContent, is_edited: true })
                .eq("id", editingMessageId);

            setEditingMessageId(null);

            if (!error) {
                // Optimistic UI: Update locally first
                setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: msgContent, is_edited: true } : m));
                setEditingMessageId(null);

                // Notify other clients via Apinator
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: `private-chat-${conversationId}`,
                        event: 'update-message',
                        data: { id: editingMessageId, content: msgContent, is_edited: true }
                    })
                }).catch(console.error);
            }

            if (error) {
                console.error("Failed to update", error);
                toast.error("Sandesh update nahi hua");
                setEditingMessageId(null);
            }
            return;
        }

        let mediaUrl = null;
        let fileKeysObj = null;

        if (selectedMedia) {
            setIsUploading(true);
            try {
                // E2EE File Blob Encryption
                const { encryptedBlob, fileKeyB64, fileIvB64 } = await encryptFileBlob(selectedMedia);
                // Create a File from Blob with original name for Catbox
                const encryptedFile = new File([encryptedBlob], "enc_" + selectedMedia.name, { type: 'application/octet-stream' });
                mediaUrl = await uploadToCatbox(encryptedFile);
                fileKeysObj = {
                    key: fileKeyB64,
                    iv: fileIvB64,
                    name: selectedMedia.name
                };
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

        // ---------------- E2E ENCRYPTION ----------------
        // 1. Prepare JSON payload
        const rawPayloadStr = JSON.stringify({
            text: msgContent || "",
            fileKeys: fileKeysObj
        });

        // 2. Fetch all recipient public keys
        const participantIds = isGroup ? groupParticipantsRef.current : [recipientId, currentUserId];
        if (!participantIds.includes(currentUserId)) participantIds.push(currentUserId);
        
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, ecdh_public_key, ecdsa_public_key, mlkem_public_key')
            .in('id', participantIds);

        const recipientPublicKeys: Record<string, {ecdh: any, mlkem: string | null}> = {};
        profiles?.forEach(p => {
            if (p.ecdh_public_key) {
                recipientPublicKeys[p.id] = {
                    ecdh: JSON.parse(p.ecdh_public_key),
                    mlkem: p.mlkem_public_key || null
                };
            }
        });

        // 3. Encrypt & Sign
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
            content: encryptedContent,  // Encrypted cipher text
            iv: iv,
            signature: signature,
            encrypted_keys: encryptedKeys,
            file_urls: mediaUrl ? [mediaUrl] : []
        };
        // ------------------------------------------------

        if (mediaFile) {
            newPayload.file_name = mediaFile.name;
            newPayload.file_size = mediaFile.size;
        }

        // TURBO-LIVE: Trigger Apinator signal parallel to Supabase insert
        const tempId = Math.random().toString(36).substring(7);
        const apinatorMsg = {
            id: tempId,
            ...newPayload,
            sender: { username: "...", full_name: "Transmitting...", avatar_url: "" },
            created_at: new Date().toISOString(),
            is_optimistic: true
        };

        const uiMsg = {
            ...apinatorMsg,
            content: msgContent || "",
            e2e_file_keys: fileKeysObj
        };

        // IMMEDIATE Optimistic UI Update for sender (Strictly Sorted)
        setMessages(prev => {
            const newArray = [...prev, uiMsg];
            return newArray.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        scrollToBottom();

        // Parallel trigger 1: Real-time message signal
        fetch('/api/apinator/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: `private-chat-${conversationId}`,
                event: 'new-message',
                data: apinatorMsg
            })
        }).catch(console.error);

        const { data: insertedMsg, error } = await supabase
            .from("messages")
            .insert(newPayload)
            .select(`
                *,
                sender:profiles!sender_id(username, full_name, avatar_url),
                post:posts(*),
                story:stories(*)
            `)
            .single();

        if (error) {
            console.error("Failed to send", error);
            toast.error("Sandesh bhej nahi paye");
        } else if (insertedMsg) {
            // Confirm the message to recipient (replacing tempId)
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-chat-${conversationId}`,
                    event: 'message-confirmed',
                    data: { tempId, actualMsg: insertedMsg }
                })
            }).catch(console.error);

            // Optimistic UI: Add to local state immediately and sort
            const finalUiMsg = {
                ...insertedMsg,
                content: msgContent || "",
                e2e_file_keys: fileKeysObj
            };

            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== tempId);
                if (filtered.some(m => m.id === finalUiMsg.id)) return filtered;
                const newArray = [...filtered, finalUiMsg];
                return newArray.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
            scrollToBottom();

            // Notify sidebar refresh for recipients (ULTRA-FAST)
            if (isGroup) {
                groupParticipantsRef.current.forEach((uid) => {
                    if (uid === currentUserId) return;
                    fetch('/api/apinator/trigger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channel: `private-sidebar-${uid}`,
                            event: 'conversation-update',
                            data: { conversationId, lastMessage: insertedMsg }
                        })
                    }).catch(console.error);
                });
            } else {
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: `private-sidebar-${recipientId}`,
                        event: 'conversation-update',
                        data: { conversationId, lastMessage: insertedMsg }
                    })
                }).catch(console.error);
            }
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
        } else {
            // Trigger realtime update for others
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-chat-${conversationId}`,
                    event: 'update-message',
                    data: { id: msgId, content: "🚫 This message was deleted", is_deleted: true }
                })
            }).catch(console.error);
        }
        setMessageContextMenuId(null);
    };

    const handleDeleteMessageForMe = async (msgId: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted_for: [...(m.deleted_for || []), currentUserId] } : m));
        const { error } = await supabase.rpc('delete_message_for_me', { msg_id: msgId });
        if (error) {
            console.error("Failed to delete for me", error);
            toast.error("Sandesh delete nahi hua");
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
        const now = Date.now();
        if (now - lastTypingSignalRef.current > 200) { // Turbo-Live: 200ms throttle
            lastTypingSignalRef.current = now;
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-chat-${conversationId}`,
                    event: 'typing',
                    data: { userId: currentUserId, isTyping: true }
                })
            }).catch(console.error);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `private-chat-${conversationId}`,
                    event: 'typing',
                    data: { userId: currentUserId, isTyping: false }
                })
            }).catch(console.error);
        }, 2000);
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

        const { data: profile } = await supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', currentUserId).single();
        const callerName = profile?.full_name || profile?.username || "Someone";
        const callerAvatar = profile?.avatar_url || "https://github.com/shadcn.png";

        if (isGroup) {
            window.dispatchEvent(new CustomEvent('start-outgoing-call', {
                detail: { roomId: conversationId, remoteUserId: null, callType: type, isGroup: true }
            }));
            toast.success("Mandli call shuru ho rahi hai...");

            groupParticipantsRef.current.forEach((uid) => {
                if (uid === currentUserId) return;
                fetch('/api/apinator/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: `private-call-${uid}`,
                        event: 'incoming-call',
                        data: {
                            roomId: conversationId,
                            callerId: currentUserId,
                            callerName: recipientName,
                            callerAvatar: recipientAvatar,
                            callType: type,
                            isGroup: true
                        }
                    })
                }).catch(console.error);
            });
            return;
        }

        window.dispatchEvent(new CustomEvent('start-outgoing-call', {
            detail: { roomId: conversationId, remoteUserId: recipientId, callType: type }
        }));
        toast.success("Bula rahe hain...");

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
                    callType: type,
                    isGroup: false
                }
            })
        }).catch(console.error);
    };

    const handleLeaveGroup = async () => {
        if (!isGroup) return;
        if (!confirm("Kya tum sach mein Mandli se nikalna chahte ho?")) return;
        const { error } = await supabase.rpc('leave_group', { conv_id: conversationId });
        if (error) {
            console.error("Failed to leave group", error);
            toast.error("Mandli chhod nahi paye.");
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
                            <AvatarFallback className="bg-zinc-800 text-zinc-400">{recipientName?.[0]}</AvatarFallback>
                        </Avatar>
                        {!isGroup && isUserOnline(recipientId) && !recipientHideStatus && (!recipientGhostUntil || new Date(recipientGhostUntil) < new Date()) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full" />}
                    </div>
                    <div className="flex flex-col justify-center -space-y-0.5">
                        <span className="font-bold text-[15px] text-white tracking-tight">{recipientName}</span>
                        {isGroup ? (
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Mandli</span>
                        ) : (
                            <span className={cn("text-[11px] font-medium transition-colors",
                                typingUsers.size > 0 ? "text-orange-400" : (isUserOnline(recipientId) && !recipientHideStatus && (!recipientGhostUntil || new Date(recipientGhostUntil) < new Date()) ? "text-green-400" : "text-zinc-400")
                            )}>
                                {typingUsers.size > 0 ? "typing..." : ((recipientHideStatus || (recipientGhostUntil && new Date(recipientGhostUntil) > new Date())) ? "Last seen hidden" : (isUserOnline(recipientId) ? "Online" : formatLastSeen(recipientLastSeen)))}
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
            </div >

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#0a0a0a] to-[#0a0a0a]" >
                {
                    loading ? (
                        <div className="flex justify-center items-center h-full" >
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
                                                             <div className="mb-2">
                                                                <EncryptedMedia
                                                                    urls={msg.file_urls}
                                                                    thumbnail={msg.thumbnail_url}
                                                                    fileName={msg.file_name}
                                                                    e2eKeys={msg.e2e_file_keys}
                                                                />
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
                                                        {msg.is_read && sendReadReceipts ? (
                                                            <CheckCheck className="w-3.5 h-3.5 text-[#ff9933]" />
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
                    )
                }
                {/* Typing Indicator Bubble */}
                {
                    typingUsers.size > 0 && (
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
                    )
                }
                <div ref={messagesEndRef} className="h-4" />
            </div >

            {/* Input Area - Instagram Style Pill */}
            < div className="p-3 bg-black/95 backdrop-blur-xl border-t border-white/5 shrink-0 w-full pb-[max(0.75rem,env(safe-area-inset-bottom))] relative" >

                {/* Media Preview Area */}
                {
                    selectedMedia && (
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
                    )
                }

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
            </div >
            {showAddMembers && (
                <AddGroupMembersDialog
                    conversationId={conversationId}
                    onClose={() => setShowAddMembers(false)}
                    onMembersAdded={() => setShowAddMembers(false)}
                />
            )}

            {/* Fullscreen Image Zoom Overlay */}
            {
                fullScreenImage && (
                    <div
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setFullScreenImage(null)}
                    >
                        <button
                            onClick={() => setFullScreenImage(null)}
                            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={fullScreenImage}
                            alt="Zoomed Media"
                            className="max-w-full max-h-full object-contain cursor-zoom-out animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
                        />
                    </div>
                )
            }
        </div >
    );
}
