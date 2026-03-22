"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

interface StitchContextType {
    isStitchMode: boolean;
    setStitchMode: (value: boolean) => Promise<void>;
    isLoadingStitch: boolean;
}

const StitchContext = createContext<StitchContextType>({
    isStitchMode: false,
    setStitchMode: async () => {},
    isLoadingStitch: true,
});

export function StitchProvider({ children }: { children: React.ReactNode }) {
    const { user, supabase } = useAuth();
    const [isStitchMode, setIsStitchModeState] = useState(false);
    const [isLoadingStitch, setIsLoadingStitch] = useState(true);

    useEffect(() => {
        // Optimistic load from local storage
        if (typeof window !== "undefined") {
            const localPreference = localStorage.getItem("connect_stitch_mode");
            if (localPreference !== null) {
                setIsStitchModeState(localPreference === "true");
            }
        }

        async function loadStitchMode() {
            if (!user) {
                setIsLoadingStitch(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('stitch_mode')
                    .eq('id', user.id)
                    .single();

                if (!error && data) {
                    setIsStitchModeState(!!data.stitch_mode);
                    localStorage.setItem("connect_stitch_mode", String(!!data.stitch_mode));
                }
            } catch (err) {
                console.error("Failed to load Stitch Mode preference:", err);
            } finally {
                setIsLoadingStitch(false);
            }
        }

        loadStitchMode();
    }, [user, supabase]);

    const setStitchMode = async (value: boolean) => {
        setIsStitchModeState(value);
        if (typeof window !== "undefined") {
            localStorage.setItem("connect_stitch_mode", String(value));
        }

        if (user) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ stitch_mode: value })
                    .eq('id', user.id);

                if (error) {
                    console.error("Error saving Stitch Mode to DB:", error);
                }
            } catch (err) {
                console.error("Exception saving Stitch Mode:", err);
            }
        }
    };

    return (
        <StitchContext.Provider value={{ isStitchMode, setStitchMode, isLoadingStitch }}>
            {children}
        </StitchContext.Provider>
    );
}

export function useStitchMode() {
    return useContext(StitchContext);
}
