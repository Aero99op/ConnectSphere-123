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
        if (!client) return;

        const channel = client.subscribe(`notifications-${userId}`);

        channel.bind('notification_ping', async (data: any) => {
            console.log("[NotificationListener] Apinator notification received:", data);
            const payload = typeof data === 'string' ? JSON.parse(data) : data;

            const { data: actor } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', payload.actor_id)
                .single();

            if (actor) showNotificationToast(actor, payload);
        });

        console.log(`[NotificationListener] Subscribed to Apinator channel: notifications-${userId}`);

        return () => {
            client.unsubscribe(`notifications-${userId}`);
            console.log(`[NotificationListener] Unsubscribed from Apinator channel: notifications-${userId}`);
        };
    }, [userId]);

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
                    <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-widest">ConnectSphere Real-time</p>
                </div>
            </div>
        ), {
            duration: 5000,
            position: 'bottom-right'
        });
    };

    return null;
}
