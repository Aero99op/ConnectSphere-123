"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { QuixViewer } from "@/components/quix/quix-viewer";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function MainQuix() {
    const { supabase, user } = useAuth();
    const [quixList, setQuixList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialId = searchParams.get('id');

    useEffect(() => {
        const fetchQuix = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from("quix")
                .select(`
                    *,
                    profiles!quix_user_id_fkey (username, avatar_url, full_name)
                `)
                .order("created_at", { ascending: false });

            if (!error && data) {
                setQuixList(data);
            }
            setLoading(false);
        };

        fetchQuix();
    }, [supabase]);

    return (
        <div className="relative w-full h-[calc(100vh-64px)] md:h-screen bg-black overflow-hidden">
            {/* Top Header Overlays */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-display font-black text-white tracking-widest uppercase">Quix</h1>
                <Link
                    href="/create?type=quix"
                    className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10"
                >
                    <Plus className="w-6 h-6" />
                </Link>
            </div>

            {/* Main Feed */}
            <QuixViewer quixList={quixList} loading={loading} initialId={initialId || undefined} />

            {/* Mobile Bottom Spacer (since BottomNav is absolute/fixed) */}
            <div className="h-16 md:hidden bg-black" />
        </div>
    );
}
