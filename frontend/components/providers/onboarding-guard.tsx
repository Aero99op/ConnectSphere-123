"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
    const { user, supabase, loading: authLoading } = useAuth();
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

        const checkOnboarding = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('is_onboarded')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.warn("Onboarding check skipped. Did you run the SQL migration? ", error.message);
                    setChecking(false);
                    return;
                }

                if (data) {
                    setIsOnboarded(data.is_onboarded);
                    const isNewUser = data.is_onboarded === false;

                    if (isNewUser && pathname !== '/onboarding') {
                        router.replace('/onboarding');
                    } else if (data.is_onboarded && pathname === '/onboarding') {
                        router.replace('/');
                    }
                }
            } catch (error) {
                console.error("Error checking onboarding status", error);
            } finally {
                setChecking(false);
            }
        };

        checkOnboarding();
    }, [user, authLoading, pathname, router, supabase]);

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
