"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ChevronLeft, Moon, Sun, Monitor, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

type Theme = 'dark' | 'light' | 'system' | 'radiant-void';

export default function AppearanceSettingsPage() {
    const { user: authUser, supabase } = useAuth();
    const userId = authUser?.id || null;
    const { theme: currentTheme, setTheme } = useTheme();

    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        async function loadAppearanceSettings() {
            try {
                if (!authUser) { setIsLoading(false); return; }
                const { data } = await supabase
                    .from('profiles')
                    .select('theme_preference')
                    .eq('id', authUser.id)
                    .single();

                if (data && data.theme_preference) {
                    // Sync next-themes with DB if they differ
                    if (data.theme_preference !== currentTheme) {
                        setTheme(data.theme_preference);
                    }
                }
            } catch (error) {
                console.error("Error loading appearance settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadAppearanceSettings();
    }, [authUser, supabase, currentTheme, setTheme]);

    const handleThemeChange = async (newTheme: Theme) => {
        if (!userId) return;
        
        // Prevent light/system for now as per old logic but allow radiant-void
        if (newTheme === 'light' || newTheme === 'system') {
            alert("Sirf Dark Mode aur Radiant Void supported hain! Light mode se aankhein phat jayengi. 🦇");
            return;
        }

        setIsUpdating(true);
        setMessage({ text: "", type: "" });

        const previousTheme = currentTheme;
        // Optimistic update
        setTheme(newTheme);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ theme_preference: newTheme })
                .eq('id', userId);

            if (error) throw error;

            setMessage({ text: "Theme updated successfully! ✨", type: "success" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);

        } catch (error: any) {
            console.error("Error updating theme:", error);
            setTheme(previousTheme as string); // Revert
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Classic Dark Mode */}
                                <button
                                    onClick={() => handleThemeChange('dark')}
                                    disabled={isUpdating}
                                    className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all ${currentTheme === 'dark'
                                        ? 'bg-primary/10 border-2 border-primary'
                                        : 'bg-black/40 border border-white/5 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center border border-white/10">
                                        <Moon className={`w-6 h-6 ${currentTheme === 'dark' ? 'text-primary' : 'text-zinc-500'}`} />
                                    </div>
                                    <span className={`font-bold text-sm ${currentTheme === 'dark' ? 'text-primary' : 'text-zinc-300'}`}>Classic Dark</span>
                                    <span className="text-[10px] text-zinc-500">The standard Connect look.</span>
                                </button>

                                {/* Radiant Void (Premium) */}
                                <button
                                    onClick={() => handleThemeChange('radiant-void')}
                                    disabled={isUpdating}
                                    className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all group overflow-hidden relative ${currentTheme === 'radiant-void'
                                        ? 'bg-primary/20 border-2 border-primary shadow-[0_0_30px_rgba(255,141,135,0.2)]'
                                        : 'bg-black border border-white/10 hover:border-primary/50'
                                        }`}
                                >
                                    {/* Animated Background for Radiant Void Button */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 opacity-50" />
                                    
                                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center border border-primary/30 relative z-10 shadow-[0_0_15px_rgba(255,141,135,0.3)]">
                                        <Sparkles className={`w-6 h-6 ${currentTheme === 'radiant-void' ? 'text-primary' : 'text-zinc-400'}`} />
                                    </div>
                                    <span className={`font-bold text-sm relative z-10 ${currentTheme === 'radiant-void' ? 'text-primary' : 'text-white'}`}>Radiant Void</span>
                                    <span className="text-[10px] text-zinc-400 relative z-10">Premium Editorial Design.</span>
                                </button>

                                {/* Light Mode (Disabled) */}
                                <button
                                    onClick={() => handleThemeChange('light')}
                                    disabled={isUpdating}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all ${currentTheme === 'light'
                                        ? 'bg-primary/10 border-2 border-primary'
                                        : 'bg-black/40 border border-white/5 hover:bg-white/5 opacity-50'
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                                        <Sun className={`w-6 h-6 ${currentTheme === 'light' ? 'text-yellow-500' : 'text-zinc-500'}`} />
                                    </div>
                                    <span className={`font-bold text-sm ${currentTheme === 'light' ? 'text-primary' : 'text-zinc-300'}`}>Light Mode</span>
                                    <span className="text-[10px] text-zinc-500">Coming soon...</span>
                                </button>

                                {/* System Default (Disabled) */}
                                <button
                                    onClick={() => handleThemeChange('system')}
                                    disabled={isUpdating}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all ${currentTheme === 'system'
                                        ? 'bg-primary/10 border-2 border-primary'
                                        : 'bg-black/40 border border-white/5 hover:bg-white/5 opacity-50'
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <Monitor className={`w-6 h-6 ${currentTheme === 'system' ? 'text-zinc-300' : 'text-zinc-500'}`} />
                                    </div>
                                    <span className={`font-bold text-sm ${currentTheme === 'system' ? 'text-primary' : 'text-zinc-300'}`}>System</span>
                                    <span className="text-[10px] text-zinc-500">Desktop default.</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
