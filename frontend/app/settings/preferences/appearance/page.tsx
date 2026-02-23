"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Moon, Sun, Monitor, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Theme = 'dark' | 'light' | 'system';

export default function AppearanceSettingsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [theme, setTheme] = useState<Theme>('dark');

    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        async function loadAppearanceSettings() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('theme_preference')
                        .eq('id', user.id)
                        .single();

                    if (data && data.theme_preference) {
                        setTheme(data.theme_preference as Theme);
                    }
                }
            } catch (error) {
                console.error("Error loading appearance settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadAppearanceSettings();
    }, []);

    const handleThemeChange = async (newTheme: Theme) => {
        if (!userId) return;
        if (newTheme !== 'dark') {
            alert("Only Dark Mode is supported right now. Light mode hurts the eyes! 🦇");
            return;
        }

        setIsUpdating(true);
        setMessage({ text: "", type: "" });

        const previousTheme = theme;
        // Optimistic update
        setTheme(newTheme);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ theme_preference: newTheme })
                .eq('id', userId);

            if (error) throw error;

        } catch (error: any) {
            console.error("Error updating theme:", error);
            setTheme(previousTheme); // Revert
            setMessage({ text: "Error! Database update failed.", type: "error" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } finally {
            setIsUpdating(false);
        }
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
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Appearance</h1>
                        <p className="text-zinc-500 text-xs mt-1">Change the app's look and feel.</p>
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
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">Theme</label>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Dark Mode */}
                                <button
                                    onClick={() => handleThemeChange('dark')}
                                    disabled={isUpdating}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all ${theme === 'dark'
                                        ? 'bg-primary/10 border-2 border-primary'
                                        : 'bg-black/40 border border-white/5 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
                                        <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-primary' : 'text-zinc-500'}`} />
                                    </div>
                                    <span className={`font-bold text-sm ${theme === 'dark' ? 'text-primary' : 'text-zinc-300'}`}>Dark Mode</span>
                                    <span className="text-[10px] text-zinc-500">Dark theme (Best)</span>
                                </button>

                                {/* Light Mode */}
                                <button
                                    onClick={() => handleThemeChange('light')}
                                    disabled={isUpdating}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all ${theme === 'light'
                                        ? 'bg-primary/10 border-2 border-primary'
                                        : 'bg-black/40 border border-white/5 hover:bg-white/5 opacity-50'
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                                        <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-yellow-500' : 'text-zinc-500'}`} />
                                    </div>
                                    <span className={`font-bold text-sm ${theme === 'light' ? 'text-primary' : 'text-zinc-300'}`}>Light Mode</span>
                                    <span className="text-[10px] text-zinc-500">Eye strain (Soon)</span>
                                </button>

                                {/* System Default */}
                                <button
                                    onClick={() => handleThemeChange('system')}
                                    disabled={isUpdating}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all ${theme === 'system'
                                        ? 'bg-primary/10 border-2 border-primary'
                                        : 'bg-black/40 border border-white/5 hover:bg-white/5 opacity-50'
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <Monitor className={`w-6 h-6 ${theme === 'system' ? 'text-zinc-300' : 'text-zinc-500'}`} />
                                    </div>
                                    <span className={`font-bold text-sm ${theme === 'system' ? 'text-primary' : 'text-zinc-300'}`}>System</span>
                                    <span className="text-[10px] text-zinc-500">System preference</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
