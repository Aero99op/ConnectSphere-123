"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useTranslation } from "@/components/providers/language-provider";
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
    Loader2,
    Users,
    MessageCircle,
    Compass,
    Gamepad2,
    Play
} from "lucide-react";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
    const { signOut } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { theme } = useTheme();

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await signOut();
        router.push("/role-selection");
    };

    const settingSections = [
        {
            title: t('settings.account_title'),
            items: [
                { icon: User, label: t('settings.edit_profile'), description: t('settings.edit_profile_desc'), href: "/settings/account/profile" },
                { icon: Shield, label: t('settings.privacy'), description: t('settings.privacy_desc'), href: "/settings/account/privacy" },
                { icon: Compass, label: t('settings.verification'), description: t('settings.verification_desc'), href: "/settings/account/verification" },
            ]
        },
        {
            title: t('settings.activity_title'),
            items: [
                { icon: Bell, label: t('settings.notifications'), description: t('settings.notifications_desc'), href: "/settings/preferences/notifications" },
                { icon: Users, label: t('settings.blocked'), description: t('settings.blocked_desc'), href: "/settings/interactions/blocked" },
                { icon: MessageCircle, label: t('settings.messages'), description: t('settings.messages_desc'), href: "/settings/interactions/messages" },
                { icon: Play, label: t('settings.stories') || "My Stories", description: t('settings.stories_desc') || "Manage your 24h stories", href: "/settings/stories" },
            ]
        },
        {
            title: t('settings.app_title'),
            items: [
                { icon: Paintbrush, label: t('settings.appearance'), description: t('settings.appearance_desc'), href: "/settings/preferences/appearance" },
                { icon: Globe, label: t('settings.language'), description: t('settings.language_desc'), href: "/settings/preferences/language" },
                { icon: HardDrive, label: t('settings.data'), description: t('settings.data_desc'), href: "/settings/preferences/data" },
            ]
        },
        {
            title: t('settings.professional_title'),
            items: [
                { icon: Globe, label: t('settings.creator'), description: t('settings.creator_desc'), href: "/settings/content/creator" },
                { icon: HelpCircle, label: t('settings.reports'), description: t('settings.reports_desc'), href: "/settings/content/reports" },
            ]
        },
        {
            title: t('settings.entertainment_title'),
            items: [
                { icon: Gamepad2, label: t('settings.games'), description: t('settings.games_desc'), href: "/settings/games" },
            ]
        },
        {
            title: t('settings.support_title'),
            items: [
                { icon: HelpCircle, label: t('settings.help'), description: t('settings.help_desc'), href: "/settings/support/help" },
                { icon: Info, label: t('settings.about'), description: t('settings.about_desc'), href: "/settings/support/about" },
            ]
        }
    ];

    return (
        <div className={cn(
            "flex w-full min-h-screen relative pb-32 md:pl-20 lg:pl-64 justify-center transition-colors duration-500",
            theme === 'radiant-void' ? "bg-black" : "bg-[#050507]"
        )}>

            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                {theme === 'radiant-void' ? (
                    <>
                        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]" />
                    </>
                ) : (
                    <>
                        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] opacity-40" />
                        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px] opacity-30" />
                    </>
                )}
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-10 z-10 px-4">

                {/* Header Section */}
                <div className="space-y-2">
                    <h1 className={cn(
                        "text-4xl font-display font-black tracking-tightest px-2",
                        theme === 'radiant-void' ? "text-white uppercase italic" : "text-white"
                    )}>
                        {theme === 'radiant-void' ? "CORE_CONFIGURATION" : t('settings.title')}
                    </h1>
                    <p className={cn(
                        "text-[10px] font-mono uppercase tracking-[0.2em] px-2",
                        theme === 'radiant-void' ? "text-primary/70" : "text-zinc-500"
                    )}>
                        {theme === 'radiant-void' ? "NODE_STATUS_STABLE // VERSION_3.0" : t('settings.header_desc')}
                    </p>
                </div>

                {/* Settings Lists */}
                <div className="space-y-10">
                    {settingSections.map((section, idx) => (
                        <div key={idx} className="space-y-4">
                            <h2 className={cn(
                                "text-[10px] font-black uppercase tracking-[0.3em] pl-4",
                                theme === 'radiant-void' ? "text-zinc-700" : "text-zinc-500"
                            )}>
                                {section.title}
                            </h2>
                            <div className={cn(
                                "overflow-hidden flex flex-col divide-y transition-all duration-500",
                                theme === 'radiant-void' 
                                    ? "bg-black/40 backdrop-blur-xl border border-white/5 rounded-xl divide-white/[0.03]" 
                                    : "glass rounded-3xl border-premium shadow-premium-md divide-white/5"
                            )}>
                                {section.items.map((item, idxi) => (
                                    <button
                                        key={idxi}
                                        className={cn(
                                            "w-full flex items-center justify-between p-5 active:scale-[0.99] transition-all group text-left",
                                            theme === 'radiant-void' ? "hover:bg-primary/[0.02]" : "hover:bg-white/5"
                                        )}
                                        onClick={() => router.push(item.href)}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500",
                                                theme === 'radiant-void' 
                                                    ? "bg-black border border-white/5 group-hover:border-primary/30 group-hover:shadow-[0_0_20px_rgba(255,141,135,0.15)]" 
                                                    : "bg-black/40 border border-white/5 group-hover:bg-primary/20"
                                            )}>
                                                <item.icon className={cn(
                                                    "w-5 h-5 transition-all duration-500",
                                                    theme === 'radiant-void' ? "text-zinc-600 group-hover:text-primary" : "text-zinc-400 group-hover:text-primary"
                                                )} />
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className={cn(
                                                    "font-bold text-[15px] uppercase tracking-wider",
                                                    theme === 'radiant-void' ? "text-zinc-300 font-mono" : "text-zinc-100"
                                                )}>{item.label}</span>
                                                <span className={cn(
                                                    "text-xs leading-relaxed",
                                                    theme === 'radiant-void' ? "text-zinc-600 font-mono italic" : "text-zinc-500"
                                                )}>{item.description}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn(
                                            "w-4 h-4 transition-all duration-500",
                                            theme === 'radiant-void' ? "text-zinc-800 group-hover:text-primary" : "text-zinc-600 group-hover:text-zinc-300"
                                        )} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Danger Zone / Logout */}
                <div className="mt-6 pb-12">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={cn(
                            "w-full flex items-center justify-center gap-3 p-5 rounded-2xl border transition-all duration-500 font-bold uppercase tracking-[0.2em] text-xs",
                            theme === 'radiant-void' 
                                ? "bg-red-500/5 border-red-500/10 text-red-500/70 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.05)]" 
                                : "border-red-500/20 bg-red-500/10 transition-all text-red-500"
                        )}
                    >
                        {isLoggingOut ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <LogOut className="w-5 h-5" />
                                <span>{t('settings.logout')}</span>
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
