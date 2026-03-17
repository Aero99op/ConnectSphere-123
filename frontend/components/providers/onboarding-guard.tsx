"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setChecking(false);
            return;
        }

        if (!isAuthenticated) {
            return;
        }

        const checkOnboarding = async () => {
            try {
                // Use server-side API with cache-busting to ensure fresh state
                const res = await fetch(`/api/onboarding?t=${Date.now()}`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                });

                if (!res.ok) {
                    console.warn("[OnboardingGuard] API returned error:", res.status);
                    // If API fails, we let them through to avoid blocking the app
                    setChecking(false);
                    return;
                }

                const data = await res.json();
                console.log("[OnboardingGuard] Status check:", data.isOnboarded);
                
                setIsOnboarded(data.isOnboarded);

                if (!data.isOnboarded && pathname !== '/onboarding') {
                    console.log("[OnboardingGuard] Redirecting to onboarding...");
                    router.replace('/onboarding');
                } else if (data.isOnboarded && pathname === '/onboarding') {
                    console.log("[OnboardingGuard] Already onboarded, going home...");
                    router.replace('/');
                }
            } catch (error) {
                console.error("[OnboardingGuard] Error checking status:", error);
                // On error, better let them through than show blank
                setChecking(false);
            } finally {
                setChecking(false);
            }
        };

        checkOnboarding();
    }, [user, authLoading, isAuthenticated, pathname, router]);

    if (authLoading || checking) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-[#09090b] fixed inset-0 z-[999]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-zinc-500 text-xs font-mono uppercase tracking-[0.2em]">Initializing...</p>
                </div>
            </div>
        );
    }

    // Instead of return null, show a loader while redirecting
    if (user && isOnboarded === false && pathname !== '/onboarding') {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-[#09090b] fixed inset-0 z-[999]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                    <p className="text-zinc-500 text-xs font-mono uppercase tracking-[0.2em]">Syncing Profile...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
