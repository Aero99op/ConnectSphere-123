"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function NotificationListener() {
    const [userId, setUserId] = useState<string | null>(null);

    // 1. Manage User Auth State
    useEffect(() => {
        let isMounted = true;
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (isMounted) setUserId(session?.user?.id || null);
        };
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted) setUserId(session?.user?.id || null);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // 2. Manage Realtime Channel
    useEffect(() => {
        if (!userId) return;
        let isMounted = true;
        let channel: any;
        let heartbeat: NodeJS.Timeout;

        const setupSubscription = () => {
            channel = supabase
                .channel(`user-notifications-${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `recipient_id=eq.${userId}`
                    },
                    async (payload) => {
                        const notification = payload.new;

                        // Fetch actor info
                        const { data: actor } = await supabase
                            .from('profiles')
                            .select('username, avatar_url')
                            .eq('id', notification.actor_id)
                            .single();

                        if (actor && isMounted) {
                            showNotificationToast(actor, notification);
                        }
                    }
                )
                .subscribe((status: string, err: any) => {
                    if (err) console.error("[NotificationListener] Subscribe error:", err);
                    console.log(`[NotificationListener] Channel status for ${userId}:`, status);
                });

            // Heartbeat for mobile
            heartbeat = setInterval(() => {
                if (channel?.state === 'joined') {
                    channel.send({ type: "broadcast", event: "heartbeat", payload: { userId } });
                }
            }, 30000);
        };

        setupSubscription();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && channel?.state === 'closed') {
                console.log("[NotificationListener] Channel closed on visibility change, re-subscribing...");
                if (heartbeat) clearInterval(heartbeat);
                setupSubscription();
            }
        };

        window.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            isMounted = false;
            window.removeEventListener("visibilitychange", handleVisibilityChange);
            if (heartbeat) clearInterval(heartbeat);
            if (channel) {
                console.log(`[NotificationListener] Cleaning up channel for ${userId}`);
                supabase.removeChannel(channel);
            }
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

    return null; // This component doesn't render anything visible
}
