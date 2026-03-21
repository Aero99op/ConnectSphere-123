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

export default function SettingsPage() {
    const { signOut } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

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
                    <h1 className="text-3xl font-display font-black text-white tracking-tight">{t('settings.title')}</h1>
                    <p className="text-zinc-500 text-sm mt-1">{t('settings.header_desc')}</p>
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
                                <span>{t('settings.logout')}</span>
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
