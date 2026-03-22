"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import { ReactNode } from "react";

export function MainContainer({ children }: { children: ReactNode }) {
    const { isStitchMode } = useStitchMode();

    if (isStitchMode) {
        return (
            <main className="w-full h-full overflow-y-auto transition-all duration-300">
                <div className="w-full h-full">
                    {children}
                </div>
            </main>
        );
    }

    return (
        <main className="w-full h-full overflow-y-auto pb-24 transition-all duration-300">
            <div className="mx-auto w-full h-full max-w-5xl">
                {children}
            </div>
        </main>
    );
}
