import Link from "next/link";
import { ChevronLeft, Info, ExternalLink, ShieldAlert, FileText } from "lucide-react";

export default function AboutSettingsPage() {
    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">About ConnectSphere</h1>
                        <p className="text-zinc-500 text-xs mt-1">App ki jaankari.</p>
                    </div>
                </div>

                {/* Content */}
                <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-8">

                    {/* App Logo & Version */}
                    <div className="flex flex-col items-center justify-center p-6 bg-black/40 rounded-3xl border border-white/5">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center shadow-premium-xl mb-4">
                            <span className="text-black font-display font-black text-3xl">CS</span>
                        </div>
                        <h2 className="text-xl font-display font-black text-white tracking-tight">ConnectSphere</h2>
                        <p className="text-zinc-500 text-xs mt-1">Version 1.0 (Beta Release)</p>
                        <span className="mt-3 text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                            Up to date
                        </span>
                    </div>

                    {/* Legal Links */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">Kanooni Baatein (Legal)</h3>
                        <div className="flex flex-col divide-y divide-white/5 bg-black/40 rounded-3xl border border-white/5">
                            <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group first:rounded-t-3xl text-left">
                                <div className="flex items-center gap-4">
                                    <FileText className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                                    <span className="font-bold text-zinc-300 text-sm">Terms of Service</span>
                                </div>
                                <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                            </button>

                            <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group text-left">
                                <div className="flex items-center gap-4">
                                    <ShieldAlert className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                                    <span className="font-bold text-zinc-300 text-sm">Privacy Policy</span>
                                </div>
                                <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                            </button>

                            <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group last:rounded-b-3xl text-left">
                                <div className="flex items-center gap-4">
                                    <Info className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                                    <span className="font-bold text-zinc-300 text-sm">Open Source Libraries</span>
                                </div>
                                <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                            </button>
                        </div>
                    </div>

                    {/* Team Info */}
                    <div className="text-center">
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                            Made with 🔥 by Team 900B
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
