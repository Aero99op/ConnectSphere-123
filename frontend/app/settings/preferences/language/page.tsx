"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Globe, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useTranslation } from "@/components/providers/language-provider";

const LANGUAGES = [
    // Global/Official
    { id: 'en', name: "English", native: "English" },
    { id: 'hi_desi', name: "Hinglish", native: "Hinglish/Hindi Mix" },
    { id: 'hi', name: "Hindi", native: "हिन्दी" },

    // Official Indian (Eighth Schedule)
    { id: 'as', name: "Assamese", native: "অসমীয়া" },
    { id: 'bn', name: "Bengali", native: "বাংলা" },
    { id: 'bo', name: "Bodo", native: "बड़ो" },
    { id: 'do', name: "Dogri", native: "डोगरी" },
    { id: 'gu', name: "Gujarati", native: "ગુજરાતી" },
    { id: 'kn', name: "Kannada", native: "ಕನ್ನಡ" },
    { id: 'ks', name: "Kashmiri", native: "كأشُر" },
    { id: 'ko', name: "Konkani", native: "कोंकणी" },
    { id: 'ma', name: "Maithili", native: "मैथिली" },
    { id: 'ml', name: "Malayalam", native: "മലയാളം" },
    { id: 'mn', name: "Manipuri", native: "ꯃꯅꯤꯄꯨꯔꯤ" },
    { id: 'mr', name: "Marathi", native: "मराठी" },
    { id: 'ne', name: "Nepali", native: "नेपाली" },
    { id: 'or', name: "Odia", native: "ଓଡ଼ିଆ" },
    { id: 'pa', name: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { id: 'sn', name: "Sanskrit", native: "संस्कृतम्" },
    { id: 'sa', name: "Santali", native: "ସାନ୍ତାଳୀ" },
    { id: 'sd', name: "Sindhi", native: "سنڌي" },
    { id: 'ta', name: "Tamil", native: "தமிழ்" },
    { id: 'te', name: "Telugu", native: "తెలుగు" },
    { id: 'ur', name: "Urdu", native: "اردو" },

    // Global Top 10
    { id: 'es', name: "Spanish", native: "Español" },
    { id: 'fr', name: "French", native: "Français" },
    { id: 'de', name: "German", native: "Deutsch" },
    { id: 'zh', name: "Chinese", native: "中文" },
    { id: 'ja', name: "Japanese", native: "日本語" },
    { id: 'ar', name: "Arabic", native: "العربية" },
    { id: 'ru', name: "Russian", native: "Русский" },
    { id: 'pt', name: "Portuguese", native: "Português" },
    { id: 'it', name: "Italian", native: "Italiano" },
    { id: 'tr', name: "Turkish", native: "Türkçe" }
];

export default function LanguageSettingsPage() {
    const { user: authUser, supabase } = useAuth();
    const { language: activeLang, setLanguage, t } = useTranslation();
    const userId = authUser?.id || null;

    const [isLoading, setIsLoading] = useState(false); // Already loaded via Provider
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    const handleLanguageSelect = async (langId: string) => {
        if (!userId) return;

        setIsUpdating(langId);
        setMessage({ text: "", type: "" });

        const previousLang = activeLang;
        // Optimistic update via provider
        setLanguage(langId);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ language_preference: langId })
                .eq('id', userId);

            if (error) throw error;

            setMessage({ text: "Settings updated successfully!", type: "success" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);

        } catch (error: any) {
            console.error("Error updating language:", error);
            setLanguage(previousLang); // Revert
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
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">{t('settings.language')}</h1>
                        <p className="text-zinc-500 text-xs mt-1">{t('settings.language_desc')}</p>
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
                            <div className={`text-xs text-center font-bold mb-2 p-2 rounded-lg ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-4 flex flex-col divide-y divide-white/5 bg-black/40 rounded-3xl border border-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {LANGUAGES.map((lang) => {
                                const isActive = activeLang === lang.id;

                                return (
                                    <button
                                        key={lang.id}
                                        onClick={() => handleLanguageSelect(lang.id)}
                                        disabled={isUpdating !== null}
                                        className={`w-full flex items-center justify-between p-4 transition-colors group text-left ${isActive ? 'bg-primary/5' : 'hover:bg-white/5 active:bg-white/10'
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
