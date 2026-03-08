import React, { createContext, useContext, ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (path: string) => string;
    isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const locale = useLocale();
    const t_intl = useTranslations();

    const setLanguage = async (lang: string) => {
        // Set cookie for next-intl and reload to apply changes
        // next-intl's middleware will pick this up on refresh
        document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`;
        window.location.reload();
    };

    const t = (path: string): string => {
        try {
            return t_intl(path);
        } catch (e) {
            return path;
        }
    };

    return (
        <LanguageContext.Provider value={{ language: locale, setLanguage, t, isLoading: false }}>
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
