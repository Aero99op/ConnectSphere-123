import Link from "next/link";
import { ChevronLeft, LifeBuoy, MailQuestion, BookOpen } from "lucide-react";

export default function HelpSettingsPage() {
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
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Help Center</h1>
                        <p className="text-zinc-500 text-xs mt-1">Pareshani ka hal aur jugaad yahan milega.</p>
                    </div>
                </div>

                {/* Content */}
                <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button className="flex flex-col gap-3 p-5 bg-black/40 border border-white/5 hover:bg-white/5 rounded-2xl transition-all group text-left">
                            <BookOpen className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                            <div>
                                <h3 className="font-bold text-zinc-100 mb-1">FAQs (Sawaal Jawaab)</h3>
                                <p className="text-[10px] text-zinc-500">Aam taur par puche gaye sawal aur unke jawaab padhein.</p>
                            </div>
                        </button>

                        <button className="flex flex-col gap-3 p-5 bg-black/40 border border-white/5 hover:bg-white/5 rounded-2xl transition-all group text-left">
                            <MailQuestion className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                            <div>
                                <h3 className="font-bold text-zinc-100 mb-1">Contact Support</h3>
                                <p className="text-[10px] text-zinc-500">Agar pareshani badi hai toh seedha humse baat karein.</p>
                            </div>
                        </button>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Urgent Help</h2>
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4">
                            <LifeBuoy className="w-6 h-6 text-red-500 shrink-0 mt-1" />
                            <div className="flex flex-col">
                                <span className="font-bold text-red-500 text-sm mb-1">Report a Safety Issue</span>
                                <span className="text-xs text-zinc-400">Agar koi aapko pareshan kar raha hai ya policy tod raha hai, turant report karein.</span>
                                <button className="mt-3 text-[10px] font-black uppercase tracking-widest text-black bg-red-500 px-4 py-2 rounded-xl w-fit hover:bg-red-600 transition-colors">
                                    Report Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
