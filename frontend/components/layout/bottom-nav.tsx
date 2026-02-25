"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Search, PlusSquare, AlertTriangle, User, ClipboardList, LayoutDashboard, Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

function BottomNavContent() {
    const pathname = usePathname();
    const [role, setRole] = useState<'citizen' | 'official' | null>(null);

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Fetch role AND assigned_area to be robust
                const { data } = await supabase.from('profiles').select('role, assigned_area').eq('id', user.id).maybeSingle();

                if (data) {
                    // Logic: Strict check for official role
                    if (data.role === 'official') {
                        setRole('official');
                    } else {
                        setRole('citizen');
                    }
                }
            }
        };
        checkRole();
    }, []);

    const searchParams = useSearchParams();
    const mode = searchParams.get('mode');

    // Hide on login/auth pages, Department Dashboard, and /messages (which is full-screen)
    if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/role-selection") || pathname.startsWith("/messages") || mode === 'department') return null;

    const citizenItems = [
        { href: "/", icon: Home, label: "Home" },
        { href: "/search", icon: Search, label: "Search" },
        { href: "/create", icon: PlusSquare, label: "Post" },
        { href: "/notifications", icon: Bell, label: "Alerts" },
        { href: "/report", icon: AlertTriangle, label: "Report" },
        { href: "/profile", icon: User, label: "Profile" },
    ];

    // In Citizen mode, we only want Citizen items for everyone to keep paths strictly separated.
    const navItems = [...citizenItems];

    return (
        <div className={cn(
            "fixed z-50 transition-all duration-500 pointer-events-auto border-premium",
            // Mobile: Bottom fixed full width
            "bottom-0 left-0 right-0 w-full bg-[#050507]/80 backdrop-blur-2xl border-t pb-1 safe-area-bottom md:pb-0",
            // Desktop: Fixed Left Sidebar
            "md:top-0 md:h-screen md:w-20 lg:w-64 md:border-r md:border-t-0 md:bg-[#050507]/40 md:backdrop-blur-3xl md:flex md:flex-col md:py-10 md:items-center lg:items-start shadow-premium-lg"
        )}>
            {/* Nav Container */}
            <div className="flex items-center justify-around h-14 w-full md:h-auto md:flex-col md:items-start md:gap-4 md:w-full md:px-4 lg:px-6">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "flex flex-col md:flex-row items-center justify-center lg:justify-start w-full gap-1 lg:gap-4 active:scale-95 transition-all group md:p-3 md:rounded-2xl md:hover:bg-white/5",
                                isActive
                                    ? "text-orange-500"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <div className={cn("p-1.5 md:p-0 rounded-xl transition-all duration-300 relative", isActive ? "bg-white/10 md:bg-transparent" : "group-hover:bg-white/5 md:group-hover:bg-transparent")}>
                                <item.icon className={cn("w-6 h-6", isActive && "fill-orange-500/20")} strokeWidth={isActive ? 2.5 : 2} />
                                {isActive && <div className="hidden md:block absolute -left-4 lg:-left-7 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-orange-500 rounded-r-md" />}
                            </div>
                            <span className={cn(
                                "text-[10px] md:text-[15px] font-medium md:hidden lg:block tracking-tighter",
                                isActive ? "text-orange-500 font-bold font-display" : "text-zinc-500 group-hover:text-zinc-200"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
}

export function BottomNav() {
    return (
        <Suspense fallback={null}>
            <BottomNavContent />
        </Suspense>
    );
}
