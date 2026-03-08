"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/components/providers/auth-provider';

type Dictionary = { [key: string]: any };

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (path: string) => string;
    isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const { user, supabase } = useAuth();
    const [language, setLanguageState] = useState('en');
    const [dictionary, setDictionary] = useState<Dictionary>({});
    const [isLoading, setIsLoading] = useState(true);

    const loadDictionary = async (lang: string) => {
        try {
            // Mapping for Hinglish and other keys
            const fileMap: { [key: string]: string } = {
                'en': 'en',
                'hi_desi': 'hi_desi',
                'hi': 'hi',
                // Fallback for others to English until translated
            };
            const fileName = fileMap[lang] || 'en';
            const dict = await import(`../../dictionaries/${fileName}.json`);
            setDictionary(dict.default || dict);
        } catch (error) {
            console.error(`Failed to load dictionary for ${lang}`, error);
            // Fallback to English
            const dict = await import(`../../dictionaries/en.json`);
            setDictionary(dict.default || dict);
        }
    };

    useEffect(() => {
        async function initLanguage() {
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('language_preference')
                    .eq('id', user.id)
                    .single();

                const pref = data?.language_preference || 'en';
                setLanguageState(pref);
                await loadDictionary(pref);
            } else {
                await loadDictionary('en');
            }
            setIsLoading(false);
        }
        initLanguage();
    }, [user, supabase]);

    const setLanguage = async (lang: string) => {
        setLanguageState(lang);
        setIsLoading(true);
        await loadDictionary(lang);
        setIsLoading(false);
    };

    const t = (path: string): string => {
        const keys = path.split('.');
        let result = dictionary;
        for (const key of keys) {
            if (result && result[key]) {
                result = result[key];
            } else {
                return path; // Return key if not found
            }
        }
        return typeof result === 'string' ? result : path;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, isLoading }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
}
