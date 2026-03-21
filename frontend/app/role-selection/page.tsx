"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

export default function RoleSelectionPage() {
    const { signOut, isAuthenticated } = useAuth();
    const router = useRouter();

    // If already authenticated, go to homefeed
    useEffect(() => {
        if (isAuthenticated) {
            router.replace("/");
        }
    }, [isAuthenticated, router]);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 selection:bg-primary/30 overflow-hidden relative">
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]" />
            </div>

            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
                <header className="text-center mb-16 space-y-4">
                    <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-4">
                        <p className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-primary/70">Secure_Access_Protocol</p>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-display font-black tracking-tightest uppercase italic">
                        Identify_Yourself
                    </h1>
                    <p className="text-zinc-500 text-sm md:text-base font-medium max-w-xl mx-auto uppercase tracking-widest leading-relaxed">
                        Select your operational role within the ConnectSphere network.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 gap-8 w-full">
                    {/* Citizen Card */}
                    <div className="flex flex-col gap-4">
                        <Link
                            href="/login?role=citizen"
                            className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-10 transition-all duration-500 hover:border-primary/50 hover:bg-white/[0.04] flex flex-col items-center text-center cursor-pointer h-full"
                        >
                            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="w-24 h-24 rounded-2xl bg-black border border-white/10 flex items-center justify-center mb-8 group-hover:shadow-[0_0_30px_rgba(255,141,135,0.2)] group-hover:border-primary/30 transition-all duration-500 -rotate-3 group-hover:rotate-0">
                                <User className="w-12 h-12 text-primary" />
                            </div>
                            
                            <h2 className="text-3xl font-display font-black text-white mb-3 uppercase italic tracking-tighter">Citizen</h2>
                            <p className="text-zinc-500 text-xs font-medium uppercase tracking-[0.15em] mb-8 leading-relaxed">Report issues, share stories, and build community trust.</p>
                            
                            <div className="mt-auto w-full py-4 rounded-xl bg-white/5 border border-white/5 text-zinc-400 group-hover:bg-primary group-hover:text-black group-hover:border-primary transition-all duration-500 flex items-center justify-center gap-3 font-mono font-black uppercase text-xs tracking-widest">
                                Initialize_Citizen <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>
                        <button
                            onClick={async () => {
                                await signOut();
                                window.location.reload();
                            }}
                            className="text-[10px] font-mono font-black text-zinc-800 hover:text-primary transition-colors uppercase tracking-[0.2em] py-2"
                        >
                            Guest_Mode // Purge_Session 🕶️
                        </button>
                    </div>

                    {/* Official Card */}
                    <div className="flex flex-col gap-4">
                        <Link
                            href="/login?role=official"
                            className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-10 transition-all duration-500 hover:border-accent/50 hover:bg-white/[0.04] flex flex-col items-center text-center cursor-pointer h-full"
                        >
                            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="w-24 h-24 rounded-2xl bg-black border border-white/10 flex items-center justify-center mb-8 group-hover:shadow-[0_0_30px_rgba(100,200,255,0.2)] group-hover:border-accent/30 transition-all duration-500 rotate-3 group-hover:rotate-0">
                                <Building2 className="w-12 h-12 text-accent" />
                            </div>
                            
                            <h2 className="text-3xl font-display font-black text-white mb-3 uppercase italic tracking-tighter">Official</h2>
                            <p className="text-zinc-500 text-xs font-medium uppercase tracking-[0.15em] mb-8 leading-relaxed">Manage crisis reports, update statuses, and serve the public.</p>
                            
                            <div className="mt-auto w-full py-4 rounded-xl bg-white/5 border border-white/5 text-zinc-400 group-hover:bg-accent group-hover:text-black group-hover:border-accent transition-all duration-500 flex items-center justify-center gap-3 font-mono font-black uppercase text-xs tracking-widest">
                                Department_Auth <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>
                        <button
                            onClick={() => router.push("/")}
                            className="text-[10px] font-mono font-black text-zinc-800 hover:text-accent transition-colors uppercase tracking-[0.2em] py-2"
                        >
                            Internal_Ops // Direct_Feed 📡
                        </button>
                    </div>
                </div>

                <footer className="mt-20 opacity-20">
                    <p className="text-[10px] font-mono font-black uppercase tracking-[0.5em] text-zinc-500">
                        ConnectSphere_V3.0_STABLE // BUILD_2026.03.21
                    </p>
                </footer>
            </div>
        </div>
    );
}
