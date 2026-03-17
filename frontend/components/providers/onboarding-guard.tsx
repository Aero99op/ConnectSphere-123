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
                // Use server-side API to bypass RLS completely
                const res = await fetch('/api/onboarding', {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                });

                if (!res.ok) {
                    console.warn("Onboarding API returned error:", res.status);
                    setChecking(false);
                    return;
                }

                const data = await res.json();

                setIsOnboarded(data.isOnboarded);

                if (!data.isOnboarded && pathname !== '/onboarding') {
                    router.replace('/onboarding');
                } else if (data.isOnboarded && pathname === '/onboarding') {
                    // Force a hard navigation to clear state if needed, or just replace
                    window.location.href = '/';
                }
            } catch (error) {
                console.error("Error checking onboarding status", error);
            } finally {
                setChecking(false);
            }
        };

        checkOnboarding();
    }, [user, authLoading, isAuthenticated]);

    if (authLoading || checking) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-background absolute z-[100] top-0 left-0">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (user && isOnboarded === false && pathname !== '/onboarding') {
        return null;
    }

    return <>{children}</>;
}
