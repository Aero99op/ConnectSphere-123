"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
    const { user, supabase, loading: authLoading, isAuthenticated } = useAuth();
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

        // Wait until the Supabase client has a real JWT (not just anon key)
        // Otherwise RLS will block the query and return 0 rows
        if (!isAuthenticated) {
            return;
        }

        const checkOnboarding = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('is_onboarded')
                    .eq('id', user.id)
                    .maybeSingle();

                if (error) {
                    console.warn("Onboarding check error:", error.message);
                    // If the column doesn't exist yet, just let user through
                    setChecking(false);
                    return;
                }

                // No profile found at all — treat as new user
                if (!data) {
                    setIsOnboarded(false);
                    if (pathname !== '/onboarding') {
                        router.replace('/onboarding');
                    }
                    setChecking(false);
                    return;
                }

                // Profile found — check is_onboarded
                setIsOnboarded(data.is_onboarded ?? true);
                const isNewUser = data.is_onboarded === false;

                if (isNewUser && pathname !== '/onboarding') {
                    router.replace('/onboarding');
                } else if (data.is_onboarded && pathname === '/onboarding') {
                    router.replace('/');
                }
            } catch (error) {
                console.error("Error checking onboarding status", error);
            } finally {
                setChecking(false);
            }
        };

        checkOnboarding();
    }, [user, authLoading, isAuthenticated, pathname, router, supabase]);

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
