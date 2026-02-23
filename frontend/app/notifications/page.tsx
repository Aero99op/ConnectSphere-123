"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Bell, Loader2, Heart, MessageCircle, UserPlus, Info } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchNotifications() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUserId(user.id);
                const { data, error } = await supabase
                    .from('notifications')
                    .select(`
                        *,
                        source_profile:profiles!notifications_source_user_id_fkey(username, avatar_url)
                    `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (!error && data) {
                    setNotifications(data);

                    // Mark as read
                    await supabase
                        .from('notifications')
                        .update({ is_read: true })
                        .eq('user_id', user.id)
                        .eq('is_read', false);
                }
            }
            setLoading(false);
        }
        fetchNotifications();
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
            case 'comment': return <MessageCircle className="w-4 h-4 text-primary" />;
            case 'follow': return <UserPlus className="w-4 h-4 text-blue-500" />;
            default: return <Info className="w-4 h-4 text-zinc-500" />;
        }
    };

    if (!userId && !loading) {
        return (
            <div className="flex w-full min-h-screen items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <p className="text-zinc-400">Please login to view your notifications.</p>
                    <Link href="/login" className="px-6 py-2 bg-primary text-black rounded-lg font-bold">Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-6 z-10 px-4">
                <div className="flex items-center gap-4 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-20 py-2">
                    <Link href="/" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ArrowLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-display font-black text-white tracking-tight flex items-center gap-2">
                            Notifications <Bell className="w-5 h-5 text-primary" />
                        </h1>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                            <Bell className="w-8 h-8 text-zinc-600" />
                        </div>
                        <p className="text-zinc-500 font-medium">No new alerts at the moment.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${notif.is_read ? 'bg-white/5 border-transparent' : 'bg-primary/5 border-primary/20 shadow-[0_0_15px_rgba(255,165,0,0.1)]'}`}
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="w-12 h-12 border border-white/10">
                                        <AvatarImage src={notif.source_profile?.avatar_url} className="object-cover" />
                                        <AvatarFallback className="bg-zinc-800 text-xs">
                                            {notif.source_profile?.username?.[0] || '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border-2 border-black">
                                        {getIcon(notif.type)}
                                    </div>
                                </div>

                                <div className="flex-1 space-y-1">
                                    <p className="text-[15px] leading-snug">
                                        <span className="font-bold text-white mr-1">
                                            {notif.source_profile?.username || 'Somebody'}
                                        </span>
                                        <span className="text-zinc-300">
                                            {notif.message}
                                        </span>
                                    </p>
                                    <p className="text-xs text-zinc-500 font-medium">
                                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
