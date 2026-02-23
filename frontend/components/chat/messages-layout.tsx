"use client";

import { useState, useEffect } from "react";
import { ChatSidebar } from "./chat-sidebar";
import { ChatView } from "./chat-view";
import { supabase } from "@/lib/supabase";
import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function MessagesLayout() {
    const [activeChat, setActiveChat] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
            setAuthChecked(true);
        };
        getUser();

        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        setMounted(true);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (mounted && authChecked && !userId) {
            router.push('/login');
        }
    }, [mounted, authChecked, userId, router]);

    if (!mounted || !authChecked || !userId) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    // Mobile View: Show either Sidebar OR ChatView
    if (isMobile) {
        return (
            <div className="w-full h-[100dvh] flex">
                {activeChat ? (
                    <div className="w-full h-full animate-in slide-in-from-right-10 duration-200 fade-in">
                        <ChatView
                            conversationId={activeChat.id}
                            recipientName={activeChat.recipient.full_name}
                            recipientAvatar={activeChat.recipient.avatar_url}
                            recipientId={activeChat.recipient.id}
                            isGroup={activeChat.recipient.is_group}
                            currentUserId={userId}
                            onBack={() => setActiveChat(null)}
                        />
                    </div>
                ) : (
                    <div className="w-full h-full animate-in slide-in-from-left-10 duration-200 fade-in">
                        <ChatSidebar
                            onSelectChat={(chat) => setActiveChat(chat)}
                            activeChatId={activeChat?.id}
                        />
                    </div>
                )}
            </div>
        );
    }

    // Desktop Split-View
    return (
        <div className="w-full h-full flex max-w-[1400px] mx-auto border-x border-white/5">
            {/* Left Sidebar */}
            <ChatSidebar
                onSelectChat={(chat) => setActiveChat(chat)}
                activeChatId={activeChat?.id}
            />

            {/* Right Chat View */}
            <div className="flex-1 h-full bg-[#050505] relative overflow-hidden">
                {activeChat ? (
                    <div className="w-full h-full animate-in fade-in zoom-in-95 duration-200">
                        <ChatView
                            conversationId={activeChat.id}
                            recipientName={activeChat.recipient.full_name}
                            recipientAvatar={activeChat.recipient.avatar_url}
                            recipientId={activeChat.recipient.id}
                            isGroup={activeChat.recipient.is_group}
                            currentUserId={userId}
                            onBack={() => setActiveChat(null)}
                        />
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                        <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-2">
                            <MessageCircle className="w-16 h-16 text-zinc-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-white">Your Messages</h3>
                        <p className="text-sm">Select a chat from the sidebar or start a new Guptugu</p>
                    </div>
                )}
            </div>
        </div>
    );
}
