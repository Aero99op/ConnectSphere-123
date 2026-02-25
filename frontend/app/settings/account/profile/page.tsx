"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ProfileEditForm } from "@/components/ui/profile-edit-form";
import { Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function ProfileEditPage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();
                setProfile(data);
            }
            setLoading(false);
        }
        fetchProfile();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black/95">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black/95 text-white">
                <p>Profile nahi mila. Login check karo.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black/95 pb-20">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] opacity-20" />
                <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] opacity-10" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto pt-6 px-4">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/settings" className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400 hover:text-white" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Edit Profile Info</h1>
                        <p className="text-zinc-500 text-sm">Naam, Bio aur Avatar badlo.</p>
                    </div>
                </div>

                <ProfileEditForm initialData={profile} />
            </div>
        </div>
    );
}
