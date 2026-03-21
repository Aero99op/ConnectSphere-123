"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusSquare, Heart, User, Compass, Menu, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getApinatorClient } from "@/lib/apinator";
import { useTheme } from "next-themes";

export function Sidebar() {
    const pathname = usePathname();
    const { user: authUser, supabase } = useAuth();
    const [user, setUser] = useState<any>(null);
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        const newTheme = theme === 'radiant-void' ? 'dark' : 'radiant-void';
        setTheme(newTheme);
        
        // Also update DB if user is logged in
        if (authUser) {
            supabase.from('profiles').update({ theme_preference: newTheme }).eq('id', authUser.id);
        }
    };

    useEffect(() => {
        const getUser = async () => {
            if (authUser) {
                const { data: profile } = await supabase.from('profiles').select('id, username, full_name, avatar_url, role').eq('id', authUser.id).maybeSingle();
                setUser(profile);
            }
        };
        getUser();

        // 🟢 Real-time Profile Sync (Apinator)
        const client = getApinatorClient();
        if (client && authUser) {
            const channel = client.subscribe(`private-profiles-${authUser.id}`);
            channel.bind('profile_updated', async (payload: any) => {
                if (payload?.data) {
                    setUser((prev: any) => ({ ...prev, ...payload.data }));
                } else {
                    getUser();
                }
            });
            return () => {
                client.unsubscribe(`profiles-${authUser.id}`);
            };
        }
    }, [authUser, supabase]);

    const links = [
        { href: "/", label: "Home", icon: Home },
        { href: "/search", label: "Search", icon: Search },
        { href: "/quix", label: "Quix", icon: Compass }, // "Compass" is Explore, feels right for Quix too
        { href: "/report", label: "Report", icon: AlertTriangle },
        { href: "/create", label: "Create", icon: PlusSquare },
        { href: "/profile", label: "Profile", icon: User, isProfile: true },
    ];

    return (
        <aside className={cn(
            "hidden md:flex flex-col w-64 h-[calc(100vh-2rem)] fixed left-4 top-4 rounded-2xl p-4 z-50 transition-all duration-500",
            theme === 'sapphire-nocturne' 
                ? "bg-background/60 backdrop-blur-3xl border-r border-primary/10 shadow-[4px_0_24px_rgba(184,196,255,0.03)]" 
                : "glass-panel"
        )}>
            {/* Logo */}
            <div className="mb-8 px-2 py-4">
                <Link href="/" className="block">
                    <h1 className={cn(
                        "text-2xl font-bold font-outfit tracking-tight bg-clip-text text-transparent italic hover:opacity-80 transition-opacity",
                        theme === 'sapphire-nocturne' 
                            ? "bg-gradient-to-r from-primary to-primary-container" 
                            : "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500"
                    )}>
                        Connect
                    </h1>
                </Link>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 space-y-2">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-4 p-3 rounded-xl transition-all group relative overflow-hidden",
                                isActive 
                                    ? (theme === 'sapphire-nocturne' ? "bg-primary/10 text-primary" : "bg-white/10 text-white") 
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {isActive && (
                                <div className={cn(
                                    "absolute left-0 top-0 bottom-0 w-1 rounded-r-full",
                                    theme === 'sapphire-nocturne' ? "bg-primary" : "bg-gradient-to-b from-orange-500 to-pink-500"
                                )} />
                            )}

                            {link.isProfile && user ? (
                                <Avatar className={cn("w-6 h-6 transition-transform group-hover:scale-110", isActive ? "ring-2 ring-white" : "")}>
                                    <AvatarImage src={user.avatar_url} />
                                    <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                                </Avatar>
                            ) : (
                                <Icon className={cn("w-6 h-6 transition-transform group-hover:scale-110", isActive ? "fill-current text-current" : "text-current")} />
                            )}
                            <span className={cn("text-sm font-medium tracking-wide", isActive ? "font-bold" : "")}>{link.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / More */}
            <div className={cn(
                "mt-auto pt-4 border-t space-y-2",
                theme === 'sapphire-nocturne' ? "border-primary/10" : "border-white/5"
            )}>
                {/* Theme Toggle Shortcut */}
                <button 
                    onClick={toggleTheme}
                    className={cn(
                        "flex items-center gap-4 p-3 rounded-xl w-full transition-all text-left group overflow-hidden relative",
                        (theme === 'radiant-void' || theme === 'sapphire-nocturne')
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-white/5 text-zinc-400 hover:text-white"
                    )}
                >
                    <Sparkles className={cn(
                        "w-6 h-6 transition-all duration-500",
                        (theme === 'radiant-void' || theme === 'sapphire-nocturne') ? "fill-primary text-primary" : "group-hover:rotate-12"
                    )} />
                    <span className="text-sm font-medium">
                        {theme === 'radiant-void' ? "Void Active" : theme === 'sapphire-nocturne' ? "Sapphire Active" : "Go Radiant"}
                    </span>
                </button>

                <button className="flex items-center gap-4 p-3 rounded-xl w-full hover:bg-white/5 text-zinc-400 hover:text-white transition-all text-left group">
                    <Menu className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                    <span className="text-sm font-medium">More</span>
                </button>
            </div>
        </aside>
    );
}
