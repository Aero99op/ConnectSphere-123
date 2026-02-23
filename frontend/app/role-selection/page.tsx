"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function RoleSelectionPage() {
    const router = useRouter();


    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
            <div className="relative z-0">
                <div className="absolute -top-20 -left-20 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
                <div className="absolute -bottom-8 left-20 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute -top-8 right-20 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
            </div>

            <h1 className="text-5xl font-extrabold mb-8 text-center z-10">
                Choose Your Role
            </h1>
            <p className="text-zinc-400 text-lg mb-12 text-center max-w-2xl z-10">
                Select whether you want to connect as a citizen to report issues or as an official to manage them.
            </p>

            <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl z-10">
                {/* Citizen Card */}
                <div className="flex flex-col gap-3">
                    <Link
                        href="/login?role=citizen"
                        className="group relative bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-primary/50 transition-all hover:scale-[1.02] flex flex-col items-center text-center cursor-pointer h-full"
                    >
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-pink-600 flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_rgba(255,100,100,0.5)] transition-shadow">
                            <User className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Connect Citizen</h2>
                        <p className="text-zinc-400 mb-6">Report issues, share stories, and connect with your community.</p>
                        <div className="w-full py-3 rounded-full bg-white/5 group-hover:bg-primary group-hover:text-white transition-colors flex items-center justify-center gap-2 font-medium">
                            Continue as Citizen <ArrowRight className="w-4 h-4" />
                        </div>
                    </Link>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.reload();
                        }}
                        className="text-xs text-zinc-500 hover:text-white underline py-2"
                    >
                        Browsing as Guest? Clear Session 🕶️
                    </button>
                </div>

                {/* Official Card */}
                <div className="flex flex-col gap-3">
                    <Link
                        href="/login?role=official"
                        className="group relative bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-blue-500/50 transition-all hover:scale-[1.02] flex flex-col items-center text-center cursor-pointer h-full"
                    >
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_rgba(50,100,255,0.5)] transition-shadow">
                            <Building2 className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2 select-none">Connect Dept</h2>
                        <p className="text-zinc-400 mb-6">Manage reports, update status, and serve the citizens.</p>
                        <div className="w-full py-3 rounded-full bg-white/5 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center gap-2 font-medium">
                            Official Login <ArrowRight className="w-4 h-4" />
                        </div>
                    </Link>
                    <button
                        onClick={() => router.push("/")}
                        className="text-xs text-zinc-500 hover:text-white italic py-2"
                    >
                        Internal Ops? Direct to Feed 📡
                    </button>
                </div>
            </div>

            <p className="mt-8 text-zinc-600 text-sm italic font-mono tracking-tighter">
                // System Environment: ConnectSphere v2.4a-STABLE
            </p>
        </div>
    );
}
