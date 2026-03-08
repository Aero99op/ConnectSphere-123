"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Globe, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useTranslation } from "@/components/providers/language-provider";

const LANGUAGES = [
    { code: 'hi_desi', name: 'Hinglish', native: 'Desi Style' },
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
    { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
    { code: 'ma', name: 'Maithili', native: 'मैथिली' },
    { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्' },
    { code: 'ks', name: 'Kashmiri', native: 'कॉशुर' },
    { code: 'ne', name: 'Nepali', native: 'नेपाली' },
    { code: 'sd', name: 'Sindhi', native: 'सिंधी' },
    { code: 'ur', name: 'Urdu', native: 'اردو' },
    { code: 'bo', name: 'Bodo', native: 'बड़ो' },
    { code: 'do', name: 'Dogri', native: 'डोगरी' },
    { code: 'ko', name: 'Konkani', native: 'कोंकणी' },
    { code: 'mn', name: 'Manipuri', native: 'মৈতেইলোন' },
    { code: 'sn', name: 'Santali', native: 'संताली' },
    // Global Languages
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'zh', name: 'Chinese', native: '中文' },
    { code: 'ja', name: 'Japanese', native: '日本語' },
    { code: 'ru', name: 'Russian', native: 'Русский' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'it', name: 'Italian', native: 'Italiano' },
    { code: 'ko_global', name: 'Korean', native: '한국어' }
];

export default function LanguageSettingsPage() {
    const { user: authUser, supabase } = useAuth();
    const { language: activeLang, setLanguage, t } = useTranslation();
    const userId = authUser?.id || null;

    const [isLoading, setIsLoading] = useState(false); // Already loaded via Provider
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    const handleLanguageSelect = async (langId: string) => {
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
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageSelect(lang.code)}
                                    disabled={isUpdating !== null}
                                    className={`flex items-center justify-between p-4 rounded-3xl border transition-all active:scale-[0.98] group ${activeLang === lang.code
                                        ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(255,165,0,0.1)]'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-lg transition-colors ${activeLang === lang.code ? 'bg-primary text-black' : 'bg-zinc-900 text-zinc-500 group-hover:text-zinc-300'}`}>
                                            {lang.code === 'hi_desi' ? '😎' : lang.code.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="text-left">
                                            <h3 className={`font-bold transition-colors ${activeLang === lang.code ? 'text-primary' : 'text-white'}`}>
                                                {lang.name}
                                            </h3>
                                            <p className="text-zinc-500 text-xs font-mono">{lang.native}</p>
                                        </div>
                                    </div>

                                    {isUpdating === lang.code ? (
                                        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                                    ) : activeLang === lang.code && (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in duration-300">
                                            <Check className="w-4 h-4 text-black stroke-[3]" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
