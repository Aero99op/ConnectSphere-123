"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getApinatorClient } from "@/lib/apinator";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function NotificationListener() {
    const { user, supabase } = useAuth();
    const userId = user?.id || null;

    // Apinator-based Realtime (UNLIMITED connections, ZERO Supabase load)
    useEffect(() => {
        if (!userId) return;

        const client = getApinatorClient();
        if (!client) {
            console.error("[NotificationListener] ❌ Apinator client is NULL! Notifications will NOT work. Check NEXT_PUBLIC_APINATOR_KEY env var.");
            return;
        }

        const channelName = `private-notifications-${userId}`;
        const channel = client.subscribe(channelName);

        const handleIncomingNotification = async (data: any) => {
            console.log("[NotificationListener] Apinator notification received:", data);
            const payload = typeof data === 'string' ? JSON.parse(data) : data;

            // For report updates, we might have the content directly
            if (payload.type === 'report_update') {
                showReportNotificationToast(payload);
                return;
            }

            // If we have direct actor data in payload (Hyper-Live mode), use it!
            if (payload.actor) {
                showNotificationToast(payload.actor, payload);
                return;
            }

            // Fallback for types that don't include actor data (Unlimited scale requires careful fetching)
            const { data: actor } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', payload.actor_id)
                .single();

            if (actor) showNotificationToast(actor, payload);
        };

        channel.bind('notification_ping', handleIncomingNotification);
        channel.bind('notification-new', handleIncomingNotification);

        console.log(`[NotificationListener] Subscribed to Apinator channel: ${channelName}`);

        return () => {
            client.unsubscribe(channelName);
            console.log(`[NotificationListener] Unsubscribed from Apinator channel: ${channelName}`);
        };
    }, [userId]);

    const showReportNotificationToast = (notification: any) => {
        toast.custom((t) => (
            <div className="flex items-center gap-4 bg-[#030613]/95 backdrop-blur-xl border border-cyan-500/30 p-5 rounded-3xl shadow-[0_0_30px_rgba(34,211,238,0.2)] animate-in slide-in-from-right-5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-inner">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm text-white font-black tracking-tightest uppercase">
                        {notification.title}
                    </p>
                    <p className="text-xs text-cyan-200/70 font-medium leading-tight">
                        {notification.content}
                    </p>
                    <p className="text-[9px] text-cyan-500/40 font-mono mt-1 uppercase tracking-widest font-black">Tactical Intel Update</p>
                </div>
            </div>
        ), {
            duration: 6000,
            position: 'top-right'
        });
    };

    const showNotificationToast = (actor: any, notification: any) => {
        let actionLabel = "";
        let entityLabel = "your content";

        switch (notification.type) {
            case 'like':
                actionLabel = "liked";
                break;
            case 'comment':
                actionLabel = "commented on";
                break;
            case 'follow':
                actionLabel = "started following";
                entityLabel = "you";
                break;
            default:
                actionLabel = "interacted with";
        }

        toast.custom((t) => (
            <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5">
                <Avatar className="w-10 h-10 border border-primary/20">
                    <AvatarImage src={actor.avatar_url} />
                    <AvatarFallback>{actor.username[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <p className="text-sm text-white font-bold leading-tight">
                        @{actor.username} <span className="font-normal text-zinc-400">{actionLabel}</span> {entityLabel}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-widest">Connect Real-time</p>
                </div>
            </div>
        ), {
            duration: 5000,
            position: 'bottom-right'
        });
    };

    return null;
}
