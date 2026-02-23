"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    User,
    Bell,
    Shield,
    Paintbrush,
    Globe,
    HardDrive,
    HelpCircle,
    Info,
    LogOut,
    ChevronRight,
    Loader2
} from "lucide-react";

export default function SettingsPage() {
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await supabase.auth.signOut();
        // Redirect completely out of the app to the role selection
        router.push("/role-selection");
    };

    const settingSections = [
        {
            title: "Account & Profile",
            items: [
                { icon: User, label: "Edit Profile Info", description: "Naam, Bio aur Avatar badlo", href: "/settings/account/profile" },
                { icon: Shield, label: "Privacy & Safety", description: "Kaun tumhari posts dekh sakta hai", href: "/settings/account/privacy" },
            ]
        },
        {
            title: "App Preferences",
            items: [
                { icon: Bell, label: "Notifications", description: "Alerts ko control karo", href: "/settings/preferences/notifications" },
                { icon: Paintbrush, label: "Appearance", description: "Dark/Light mode aur themes", href: "/settings/preferences/appearance" },
                { icon: Globe, label: "Language", description: "Hindi, English, etc.", href: "/settings/preferences/language" },
                { icon: HardDrive, label: "Data Usage", description: "Media auto-play aur quality", href: "/settings/preferences/data" },
            ]
        },
        {
            title: "Support & About",
            items: [
                { icon: HelpCircle, label: "Help Center", description: "Jugaad aur pareshani ka hal", href: "/settings/support/help" },
                { icon: Info, label: "About ConnectSphere", description: "Version 1.0 (Beta)", href: "/settings/support/about" },
            ]
        }
    ];

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 md:pl-20 lg:pl-64 justify-center">

            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] opacity-40" />
                <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] opacity-30" />
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">

                {/* Header Section */}
                <div>
                    <h1 className="text-3xl font-display font-black text-white tracking-tight">Settings</h1>
                    <p className="text-zinc-500 text-sm mt-1">Apna account aur app preference set karo.</p>
                </div>

                {/* Settings Lists */}
                <div className="space-y-8">
                    {settingSections.map((section, idx) => (
                        <div key={idx} className="space-y-3">
                            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest pl-2">
                                {section.title}
                            </h2>
                            <div className="glass rounded-3xl border-premium shadow-premium-md overflow-hidden flex flex-col divide-y divide-white/5">
                                {section.items.map((item, idxi) => (
                                    <button
                                        key={idxi}
                                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-colors group text-left"
                                        onClick={() => router.push(item.href)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                <item.icon className="w-5 h-5 text-zinc-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-zinc-100 text-[15px]">{item.label}</span>
                                                <span className="text-xs text-zinc-500">{item.description}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Danger Zone / Logout */}
                <div className="mt-4 pb-10">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] transition-all text-red-500 font-bold"
                    >
                        {isLoggingOut ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <LogOut className="w-5 h-5" />
                                <span>Logout (Bahar Niklo)</span>
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
