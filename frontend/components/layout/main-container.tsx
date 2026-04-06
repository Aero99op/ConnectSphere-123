"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainContainer({ children }: { children: ReactNode }) {
    const { isStitchMode } = useStitchMode();
    const pathname = usePathname() || "";

    const isFullScreenRoute = pathname.startsWith("/login") || 
                              pathname.startsWith("/auth") ||    
                              pathname.startsWith("/role-selection") || 
                              pathname.startsWith("/messages") || 
                              pathname.startsWith("/dashboard");

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
        <main className={cn(
            "w-full h-full overflow-y-auto transition-all duration-300",
            !isFullScreenRoute ? "pb-24 md:pb-0 md:pl-20 lg:pl-64" : ""
        )}>
            <div className="mx-auto w-full h-full max-w-5xl">
                {children}
            </div>
        </main>
    );
}
