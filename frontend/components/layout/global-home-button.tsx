"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home } from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";

function GlobalHomeButtonContent() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode');

    const [role, setRole] = useState<'citizen' | 'official' | null>(null);

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (data) setRole(data.role as 'citizen' | 'official');
            }
        };
        checkRole();
    }, []);

    // Do not show on Home page itself
    if (pathname === "/") return null;

    // Hide on Auth/Login/Role Selection
    if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/role-selection")) return null;

    // Hide in Department Mode
    if (mode === 'department' || (role === 'official' && !searchParams.has('mode'))) return null;

    return (
        <Link
            href="/"
            className="fixed top-4 left-4 z-[60] bg-zinc-900/80 backdrop-blur-md border border-white/10 p-2.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg active:scale-95 group"
            title="Ghar (Home)"
        >
            <Home className="w-5 h-5 group-hover:text-orange-400 transition-colors" />
        </Link>
    );
}

export function GlobalHomeButton() {
    return (
        <Suspense fallback={null}>
            <GlobalHomeButtonContent />
        </Suspense>
    );
}
