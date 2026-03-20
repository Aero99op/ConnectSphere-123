"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Shield, Lock, EyeOff, UserCheck, Loader2, Ghost } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export default function PrivacySettingsPage() {
    const { user: authUser, supabase } = useAuth();
    const userId = authUser?.id || null;
    const [isPrivate, setIsPrivate] = useState(false);
    const [hideOnlineStatus, setHideOnlineStatus] = useState(false);
    const [ghostModeUntil, setGhostModeUntil] = useState<Date | null>(null);
    const [ghostModeRemaining, setGhostModeRemaining] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null); // To track which toggle is updating
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        async function loadPrivacySettings() {
            try {
                if (!authUser) { setIsLoading(false); return; }
                const { data, error } = await supabase
                    .from('profiles')
                    .select('is_private, hide_online_status, ghost_mode_until')
                    .eq('id', authUser.id)
                    .single();

                if (data) {
                    setIsPrivate(data.is_private || false);
                    setHideOnlineStatus(data.hide_online_status || false);
                    if (data.ghost_mode_until) {
                        const expiry = new Date(data.ghost_mode_until);
                        if (expiry > new Date()) {
                            setGhostModeUntil(expiry);
                        } else {
                            // Already expired, clean it up
                            supabase.from('profiles').update({ ghost_mode_until: null }).eq('id', authUser.id).then();
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading privacy settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadPrivacySettings();
    }, [authUser, supabase]);

    useEffect(() => {
        if (!ghostModeUntil) {
            setGhostModeRemaining(null);
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            if (now >= ghostModeUntil) {
                setGhostModeUntil(null);
                setGhostModeRemaining(null);
                clearInterval(interval);
            } else {
                const diffTime = Math.abs(ghostModeUntil.getTime() - now.getTime());
                const hours = Math.floor(diffTime / (1000 * 60 * 60));
                const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);

                let timeStr = "";
                if (hours > 0) timeStr += `${hours}h `;
                timeStr += `${minutes}m ${seconds}s`;
                setGhostModeRemaining(timeStr);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [ghostModeUntil]);

    const toggleSetting = async (field: 'is_private' | 'hide_online_status', currentValue: boolean) => {
        if (!userId) return;

        setIsUpdating(field);
        setMessage({ text: "", type: "" });

        const newValue = !currentValue;

        // Optimistic UI update
        if (field === 'is_private') setIsPrivate(newValue);
        if (field === 'hide_online_status') setHideOnlineStatus(newValue);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ [field]: newValue })
                .eq('id', userId);

            if (error) throw error;

        } catch (error: any) {
            console.error(`Error updating ${field}:`, error);
            // Revert on error
            if (field === 'is_private') setIsPrivate(currentValue);
            if (field === 'hide_online_status') setHideOnlineStatus(currentValue);
            setMessage({ text: "Gadbad! Database update nahi hua.", type: "error" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } finally {
            setIsUpdating(null);
        }
    };

    const activateGhostMode = async (minutes: number) => {
        if (!userId) return;
        setIsUpdating('ghost_mode');
        setMessage({ text: "", type: "" });

        const expiry = new Date(Date.now() + minutes * 60000);

        // Optimistic
        setGhostModeUntil(expiry);

        try {
            const { error } = await supabase.from('profiles').update({ ghost_mode_until: expiry.toISOString() }).eq('id', userId);
            if (error) throw error;
        } catch (e) {
            console.error("Ghost mode error:", e);
            setGhostModeUntil(null);
            setMessage({ text: "Ghost mode chalu nahi hua.", type: "error" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } finally {
            setIsUpdating(null);
        }
    };

    const deactivateGhostMode = async () => {
        if (!userId) return;
        setIsUpdating('ghost_mode');

        setGhostModeUntil(null);

        try {
            await supabase.from('profiles').update({ ghost_mode_until: null }).eq('id', userId);
        } catch (e) { }
        setIsUpdating(null);
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Privacy & Safety</h1>
                        <p className="text-zinc-500 text-xs mt-1">Apna account secure rakho.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-6">

                        {message.text && (
                            <div className={`text-xs text-center font-bold mb-2 p-2 rounded-lg ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : ''}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Private Account Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <Lock className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">Private Account</span>
                                        <span className="text-[10px] text-zinc-500">Sirf tumhaare followers tumhaari posts dekh sakte hain.</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isPrivate}
                                        onChange={() => toggleSetting('is_private', isPrivate)}
                                        disabled={isUpdating === 'is_private'}
                                    />
                                    <div className={`w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isPrivate ? 'bg-primary' : ''}`}></div>
                                </label>
                            </div>

                            {/* Hide Online Status Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <EyeOff className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">Hide online status</span>
                                        <span className="text-[10px] text-zinc-500">Log nahi dekh paayenge tum kab online thi/the.</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={hideOnlineStatus}
                                        onChange={() => toggleSetting('hide_online_status', hideOnlineStatus)}
                                        disabled={isUpdating === 'hide_online_status'}
                                    />
                                    <div className={`w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${hideOnlineStatus ? 'bg-primary' : ''}`}></div>
                                </label>
                            </div>

                            {/* Ghost Mode (Timed) */}
                            <div className="flex flex-col p-4 bg-black/40 rounded-2xl border border-white/5 gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Ghost className={`w-6 h-6 ${ghostModeUntil ? 'text-orange-500' : 'text-zinc-500'}`} />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-zinc-100">Ghost Mode (Timed)</span>
                                            <span className="text-[10px] text-zinc-500">Read receipts band karo aur offline dikho.</span>
                                        </div>
                                    </div>
                                    {ghostModeUntil && (
                                        <button
                                            onClick={deactivateGhostMode}
                                            disabled={isUpdating === 'ghost_mode'}
                                            className="text-[10px] uppercase font-bold tracking-widest bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                                        >
                                            Turn Off
                                        </button>
                                    )}
                                </div>

                                {ghostModeUntil ? (
                                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                            <span className="text-xs text-orange-400 font-bold uppercase tracking-wide">Ghost Mode Active</span>
                                        </div>
                                        <span className="text-xs font-mono text-orange-300 font-bold">{ghostModeRemaining}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {[15, 30, 45, 60, 360, 720].map(mins => (
                                            <button
                                                key={mins}
                                                onClick={() => activateGhostMode(mins)}
                                                disabled={isUpdating === 'ghost_mode'}
                                                className="bg-zinc-800/50 hover:bg-white/10 text-[11px] font-medium px-4 py-2 rounded-xl transition-colors border border-white/5 disabled:opacity-50"
                                            >
                                                {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Two-Factor Auth (Static) */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 opacity-50 cursor-not-allowed">
                                <div className="flex items-center gap-4">
                                    <UserCheck className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">Two-Factor Authentication</span>
                                        <span className="text-[10px] text-zinc-500">Future update me aayega.</span>
                                    </div>
                                </div>
                                <button disabled className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-700 px-3 py-1.5 rounded-lg">
                                    Setup
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
