"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusSquare, Heart, MessageCircle, User, Compass, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getApinatorClient } from "@/lib/apinator";

export function Sidebar() {
    const pathname = usePathname();
    const { user: authUser, supabase } = useAuth();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const getUser = async () => {
            if (authUser) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
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
        { href: "/messages", label: "Messages", icon: MessageCircle },
        { href: "/notifications", label: "Notifications", icon: Heart },
        { href: "/create", label: "Create", icon: PlusSquare },
        { href: "/profile", label: "Profile", icon: User, isProfile: true },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 h-[calc(100vh-2rem)] fixed left-4 top-4 glass-panel rounded-2xl p-4 z-50 transition-all duration-300">
            {/* Logo */}
            <div className="mb-8 px-2 py-4">
                <Link href="/" className="block">
                    <h1 className="text-2xl font-bold font-outfit tracking-tight bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent italic hover:opacity-80 transition-opacity">
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
                                isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-pink-500 rounded-r-full" />
                            )}

                            {link.isProfile && user ? (
                                <Avatar className={cn("w-6 h-6 transition-transform group-hover:scale-110", isActive ? "ring-2 ring-white" : "")}>
                                    <AvatarImage src={user.avatar_url} />
                                    <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                                </Avatar>
                            ) : (
                                <Icon className={cn("w-6 h-6 transition-transform group-hover:scale-110", isActive ? "fill-white/20 text-white" : "text-current")} />
                            )}
                            <span className={cn("text-sm font-medium tracking-wide", isActive ? "font-bold" : "")}>{link.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / More */}
            <div className="mt-auto pt-4 border-t border-white/5">
                <button className="flex items-center gap-4 p-3 rounded-xl w-full hover:bg-white/5 text-zinc-400 hover:text-white transition-all text-left group">
                    <Menu className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                    <span className="text-sm font-medium">More</span>
                </button>
            </div>
        </aside>
    );
}
