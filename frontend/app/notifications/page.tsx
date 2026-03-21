"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ArrowLeft, Bell, Loader2, Heart, MessageCircle, UserPlus, Info } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
    const { user: authUser, supabase } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const userId = authUser?.id || null;
    const { theme } = useTheme();

    useEffect(() => {
        async function fetchNotifications() {
            if (!authUser) { setLoading(false); return; }
            setLoading(true);

            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    *,
                    actor_profile:profiles!notifications_actor_id_fkey(username, avatar_url, role)
                `)
                .eq('recipient_id', authUser.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                setNotifications(data);

                await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('recipient_id', authUser.id)
                    .eq('is_read', false);
            }
            setLoading(false);
        }
        fetchNotifications();
    }, [authUser, supabase]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
            case 'comment': return <MessageCircle className="w-4 h-4 text-primary" />;
            case 'follow': return <UserPlus className="w-4 h-4 text-blue-500" />;
            default: return <Info className="w-4 h-4 text-zinc-500" />;
        }
    };

    const getMessageText = (type: string) => {
        switch (type) {
            case 'like': return 'liked your post or story.';
            case 'comment': return 'commented on your post.';
            case 'follow': return 'started following you.';
            default: return 'interacted with you.';
        }
    };

    if (!userId && !loading) {
        return (
            <div className={cn(
                "flex w-full min-h-screen items-center justify-center p-4",
                theme === 'radiant-void' ? "bg-black" : "bg-[#050507]"
            )}>
                <div className="text-center space-y-6">
                    <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Login required to access notification archive.</p>
                    <Link href="/login">
                        <Button className="px-8 py-2 bg-primary text-black rounded-lg font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(255,141,135,0.3)]">Login</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex w-full min-h-screen text-white relative pb-20 justify-center transition-colors duration-500",
            theme === 'radiant-void' ? "bg-black" : "bg-[#09090b]"
        )}>
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                {theme === 'radiant-void' ? (
                    <>
                        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
                        <div className="absolute top-1/2 right-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
                    </>
                ) : (
                    <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] opacity-40" />
                )}
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                <div className={cn(
                    "flex items-center gap-4 sticky top-0 z-20 py-4 px-2 -mx-2 transition-all duration-500",
                    theme === 'radiant-void' ? "bg-black/40 backdrop-blur-xl" : "bg-[#09090b]/80 backdrop-blur-md"
                )}>
                    <Link href="/" className={cn(
                        "p-2.5 rounded-xl transition-all active:scale-90",
                        theme === 'radiant-void' ? "bg-white/5 border border-white/10 hover:bg-white/10" : "glass hover:bg-white/10"
                    )}>
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className={cn(
                            "text-2xl font-display font-black tracking-tight flex items-center gap-3",
                            theme === 'radiant-void' ? "uppercase italic" : ""
                        )}>
                            Alerts <Bell className={cn("w-5 h-5", theme === 'radiant-void' ? "text-primary shadow-primary" : "text-primary")} />
                        </h1>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-20">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center gap-6 opacity-40">
                        <div className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center border transition-all duration-700",
                            theme === 'radiant-void' ? "bg-primary/5 border-primary/20 shadow-[0_0_30px_rgba(255,141,135,0.1)]" : "bg-white/5 border-white/5"
                        )}>
                            <Bell className={cn("w-10 h-10", theme === 'radiant-void' ? "text-primary" : "text-zinc-600")} />
                        </div>
                        <p className={cn(
                            "text-[10px] font-mono font-black uppercase tracking-[0.4em]",
                            theme === 'radiant-void' ? "text-primary/50" : "text-zinc-500"
                        )}>System_Clean_No_New_Alerts</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={cn(
                                    "group relative p-4 transition-all duration-500 border",
                                    theme === 'radiant-void' 
                                        ? cn(
                                            "bg-black rounded-xl border-white/5 hover:border-white/10",
                                            !notif.is_read && "border-primary/20 bg-primary/[0.02]"
                                          )
                                        : cn(
                                            "rounded-2xl",
                                            notif.is_read ? 'bg-white/5 border-transparent' : 'bg-primary/5 border-primary/20 shadow-[0_0_15px_rgba(255,165,0,0.1)]'
                                          )
                                )}
                            >
                                {theme === 'radiant-void' && !notif.is_read && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_15px_rgba(255,141,135,0.8)]" />
                                )}
                                
                                <div className="flex items-start gap-4">
                                    <div className="relative shrink-0">
                                        <div className={cn(
                                            "absolute inset-0 blur-md rounded-full scale-0 group-hover:scale-110 transition-transform",
                                            theme === 'radiant-void' ? "bg-primary/20" : "bg-primary/10"
                                        )} />
                                        <Avatar className={cn(
                                            "w-12 h-12 border relative z-10 transition-all group-hover:scale-105",
                                            theme === 'radiant-void' ? "rounded-lg border-primary/20" : "rounded-2xl border-white/10"
                                        )}>
                                            <AvatarImage src={notif.actor_profile?.avatar_url} className="object-cover" />
                                            <AvatarFallback className="bg-zinc-800 text-xs font-mono font-black">
                                                {notif.actor_profile?.username?.[0] || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={cn(
                                            "absolute -bottom-1 -right-1 rounded-full p-1 border-2 transition-all",
                                            theme === 'radiant-void' ? "bg-black border-black" : "bg-zinc-900 border-zinc-950"
                                        )}>
                                            {getIcon(notif.type)}
                                        </div>
                                    </div>
    
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <p className="text-sm sm:text-[15px] leading-snug">
                                            <span className={cn(
                                                "font-black mr-1.5 transition-colors group-hover:text-primary",
                                                theme === 'radiant-void' ? "text-white uppercase italic" : "text-white"
                                            )}>
                                                {notif.actor_profile?.username || 'Somebody'}
                                            </span>
                                            <span className={cn(
                                                "transition-colors",
                                                theme === 'radiant-void' ? "text-zinc-400 font-medium" : "text-zinc-300"
                                            )}>
                                                {getMessageText(notif.type)}
                                            </span>
                                        </p>
                                        <p className="text-[10px] font-mono font-black uppercase tracking-widest text-zinc-600">
                                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                        </p>
                                    </div>
                                    {!notif.is_read && (
                                        <div className="w-2 h-2 rounded-full bg-primary mt-2 animate-pulse shadow-[0_0_10px_rgba(255,141,135,0.8)]" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
