"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useTranslation } from "@/components/providers/language-provider";
import {
    User, Bell, Shield, Paintbrush, Globe, HardDrive, HelpCircle,
    Info, LogOut, ChevronRight, Loader2, Users, MessageCircle,
    Compass, Gamepad2, Play
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StitchSettings() {
    const { signOut, user: authUser } = useAuth();
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
            title: t('settings.account_title') || "Account",
            items: [
                { icon: User, label: t('settings.edit_profile') || "Edit Profile", description: t('settings.edit_profile_desc') || "Update your details", href: "/settings/account/profile" },
                { icon: Shield, label: t('settings.privacy') || "Privacy & Security", description: t('settings.privacy_desc') || "Manage who sees what", href: "/settings/account/privacy" },
                { icon: Compass, label: t('settings.verification') || "Verification", description: t('settings.verification_desc') || "Get the blue check", href: "/settings/account/verification" },
            ]
        },
        {
            title: t('settings.activity_title') || "Activity",
            items: [
                { icon: Bell, label: t('settings.notifications') || "Notifications", description: t('settings.notifications_desc') || "Manage alerts", href: "/settings/preferences/notifications" },
                { icon: Users, label: t('settings.blocked') || "Blocked Users", description: t('settings.blocked_desc') || "Manage block list", href: "/settings/interactions/blocked" },
                { icon: MessageCircle, label: t('settings.messages') || "Messages", description: t('settings.messages_desc') || "Chat preferences", href: "/settings/interactions/messages" },
                { icon: Play, label: t('settings.stories') || "My Stories", description: t('settings.stories_desc') || "Manage your 24h stories", href: "/settings/stories" },
            ]
        },
        {
            title: t('settings.app_title') || "App Settings",
            items: [
                { icon: Paintbrush, label: t('settings.appearance') || "Appearance", description: t('settings.appearance_desc') || "Themes and visuals", href: "/settings/preferences/appearance" },
                { icon: Globe, label: t('settings.language') || "Language", description: t('settings.language_desc') || "Change app language", href: "/settings/preferences/language" },
                { icon: HardDrive, label: t('settings.data') || "Data & Storage", description: t('settings.data_desc') || "Manage cache", href: "/settings/preferences/data" },
            ]
        },
        {
            title: t('settings.professional_title') || "Professional Tools",
            items: [
                { icon: Globe, label: t('settings.creator') || "Creator Studio", description: t('settings.creator_desc') || "Analytics & tools", href: "/settings/content/creator" },
                { icon: HelpCircle, label: t('settings.reports') || "Civic Reports", description: t('settings.reports_desc') || "View your reports", href: "/settings/content/reports" },
            ]
        },
        {
            title: t('settings.entertainment_title') || "Entertainment",
            items: [
                { icon: Gamepad2, label: t('settings.games') || "Games Center", description: t('settings.games_desc') || "Play mini-games", href: "/settings/games" },
            ]
        },
        {
            title: t('settings.support_title') || "Support",
            items: [
                { icon: HelpCircle, label: t('settings.help') || "Help Center", description: t('settings.help_desc') || "FAQs & contact", href: "/settings/support/help" },
                { icon: Info, label: t('settings.about') || "About Connect", description: t('settings.about_desc') || "Version & legal", href: "/settings/support/about" },
            ]
        }
    ];

    return (
        <div className="bg-[#0c0e12] text-[#f8f9fe] font-body selection:bg-[#ba9eff]/30 min-h-screen overflow-x-hidden pb-16 md:pb-0">
            <style dangerouslySetInnerHTML={{ __html: `
                .font-headline { font-family: 'Plus Jakarta Sans', sans-serif; }
            `}} />

            {/* Background Effects */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-[#ba9eff]/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-1/4 -left-20 w-[500px] h-[500px] bg-[#53ddfc]/5 blur-[150px] rounded-full"></div>
            </div>

            {/* Sidebar Navigation */}
            <aside className="fixed left-0 top-0 h-full z-50 hidden md:flex flex-col p-6 w-64 border-r border-white/10 bg-[#0c0e12]/80 backdrop-blur-2xl shadow-[40px_0_40px_rgba(139,92,246,0.05)]">
                <div className="mb-12 cursor-pointer" onClick={() => router.push('/')}>
                    <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#ba9eff] to-[#8455ef]">Connect</h1>
                    <p className="font-headline tracking-tight font-bold text-xs text-slate-500 uppercase mt-1">Control Center</p>
                </div>
                <nav className="flex flex-col space-y-2 flex-grow">
                    <Link href="/" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        <span>Home</span>
                    </Link>
                    <Link href="/search" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <span>Search</span>
                    </Link>
                    <Link href="/quix" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        <span>Quix</span>
                    </Link>
                    <Link href="/create" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                        <span>Create</span>
                    </Link>
                    <Link href="/report" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                        <span>Report</span>
                    </Link>
                    <Link href={`/profile/${authUser?.id}`} className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span>Profile</span>
                    </Link>
                </nav>
            </aside>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 z-50 w-full h-16 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4">
                <Link href="/" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></Link>
                <Link href="/search" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></Link>
                <Link href="/create" className="w-10 h-10 bg-gradient-to-tr from-[#ba9eff] to-[#53ddfc] rounded-full flex items-center justify-center text-black shadow-lg shadow-[#ba9eff]/30 scale-110"><svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></Link>
                <Link href="/quix" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></Link>
                <Link href="/report" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg></Link>
                <Link href={`/profile/${authUser?.id}`} className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></Link>
            </div>

            {/* Main Content Area */}
            <main className="relative z-10 md:ml-64 p-6 md:p-12 mb-20 max-w-4xl mx-auto flex flex-col gap-10">
                {/* Header */}
                <div className="space-y-3 px-2">
                    <h2 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                        Settings
                    </h2>
                    <p className="text-[#a9abb0] text-sm uppercase tracking-[0.2em] font-bold">
                        Configure Your Reality
                    </p>
                </div>

                {/* Settings Lists */}
                <div className="space-y-12">
                    {settingSections.map((section, idx) => (
                        <div key={idx} className="space-y-4">
                            <h3 className="text-xs font-black text-[#53ddfc] uppercase tracking-widest pl-2 font-headline">
                                {section.title}
                            </h3>
                            <div className="flex flex-col rounded-3xl bg-white/5 border border-white/5 overflow-hidden divide-y divide-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                                {section.items.map((item, idxi) => (
                                    <Link
                                        key={idxi}
                                        href={item.href}
                                        className="flex items-center justify-between p-5 hover:bg-white/5 active:bg-white/10 transition-colors group"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#ba9eff]/20 group-hover:border-[#ba9eff]/30 transition-all duration-300 shadow-inner glow-primary">
                                                <item.icon className="w-5 h-5 text-slate-400 group-hover:text-[#ba9eff] transition-colors" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-sm tracking-wide text-white group-hover:text-[#ba9eff] transition-colors">{item.label}</span>
                                                <span className="text-xs text-slate-500">{item.description}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-[#ba9eff] group-hover:translate-x-1 transition-all" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Danger Zone / Logout */}
                <div className="mt-8">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full sm:w-auto px-8 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-2xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                    >
                        {isLoggingOut ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <LogOut className="w-5 h-5" />
                                <span>Log Out</span>
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
