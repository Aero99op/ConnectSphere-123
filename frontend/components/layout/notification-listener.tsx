"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function NotificationListener() {
    useEffect(() => {
        let channel: any;

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            channel = supabase
                .channel(`user-notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `recipient_id=eq.${user.id}`
                    },
                    async (payload) => {
                        const notification = payload.new;

                        // Fetch actor info
                        const { data: actor } = await supabase
                            .from('profiles')
                            .select('username, avatar_url')
                            .eq('id', notification.actor_id)
                            .single();

                        if (actor) {
                            showNotificationToast(actor, notification);
                        }
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

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

    return null; // This component doesn't render anything visible
}
