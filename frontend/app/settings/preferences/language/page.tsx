"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Globe, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const LANGUAGES = [
    { id: 'en', name: "English", native: "English" },
    { id: 'hi', name: "Hindi", native: "हिन्दी" },
    { id: 'bn', name: "Bengali", native: "বাংলা" },
    { id: 'te', name: "Telugu", native: "తెలుగు" },
    { id: 'mr', name: "Marathi", native: "मराठी" },
];

export default function LanguageSettingsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [activeLang, setActiveLang] = useState<string>('en');

    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        async function loadLanguageSettings() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('language_preference')
                        .eq('id', user.id)
                        .single();

                    if (data && data.language_preference) {
                        setActiveLang(data.language_preference);
                    }
                }
            } catch (error) {
                console.error("Error loading language settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadLanguageSettings();
    }, []);

    const handleLanguageSelect = async (langId: string) => {
        if (!userId) return;
        if (langId !== 'en' && langId !== 'hi') {
            alert("Currently only English and Hindi are supported, more coming soon!");
            return;
        }

        setIsUpdating(langId);
        setMessage({ text: "", type: "" });

        const previousLang = activeLang;
        // Optimistic update
        setActiveLang(langId);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ language_preference: langId })
                .eq('id', userId);

            if (error) throw error;

        } catch (error: any) {
            console.error("Error updating language:", error);
            setActiveLang(previousLang); // Revert
            setMessage({ text: "Error! Database update failed.", type: "error" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } finally {
            setIsUpdating(null);
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
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Language</h1>
                        <p className="text-zinc-500 text-xs mt-1">Select your preferred app language.</p>
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

                        <div className="space-y-4 flex flex-col divide-y divide-white/5 bg-black/40 rounded-3xl border border-white/5">
                            {LANGUAGES.map((lang) => {
                                const isActive = activeLang === lang.id;
                                const isDisallowed = lang.id !== 'en' && lang.id !== 'hi';

                                return (
                                    <button
                                        key={lang.id}
                                        onClick={() => handleLanguageSelect(lang.id)}
                                        disabled={isUpdating !== null}
                                        className={`w-full flex items-center justify-between p-4 transition-colors group text-left first:rounded-t-3xl last:rounded-b-3xl ${isDisallowed ? 'opacity-40 hover:bg-transparent cursor-not-allowed' : 'hover:bg-white/5 active:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Globe className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                                            <div className="flex flex-col">
                                                <span className={`font-bold text-[15px] ${isActive ? 'text-primary' : 'text-zinc-300'}`}>{lang.native}</span>
                                                <span className="text-xs text-zinc-500">{lang.name}</span>
                                            </div>
                                        </div>
                                        {isUpdating === lang.id ? (
                                            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                                        ) : isActive ? (
                                            <Check className="w-5 h-5 text-primary" />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
