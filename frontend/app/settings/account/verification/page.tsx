"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Compass, BadgeCheck, ShieldAlert, FileText, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export default function VerificationSettingsPage() {
    const { user: authUser, supabase } = useAuth();
    const userId = authUser?.id || null;
    const [status, setStatus] = useState<'none' | 'pending' | 'verified'>('none');
    const [reason, setReason] = useState("");
    const [documentUrl, setDocumentUrl] = useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        async function loadVerificationStatus() {
            try {
                if (!authUser) { setIsLoading(false); return; }
                const { data } = await supabase
                    .from('profiles')
                    .select('verification_status')
                    .eq('id', authUser.id)
                    .single();

                if (data && data.verification_status) {
                    setStatus(data.verification_status as any);
                }
            } catch (error) {
                console.error("Error loading verification status:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadVerificationStatus();
    }, [authUser, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;
        if (!reason.trim()) {
            setMessage({ text: "Please provide a reason for verification.", type: "error" });
            return;
        }

        setIsSubmitting(true);
        setMessage({ text: "", type: "" });

        try {
            // In a real app, we'd insert into a 'verification_requests' table.
            // For now, we update the profile status to 'pending'.
            const { error } = await supabase
                .from('profiles')
                .update({
                    verification_status: 'pending',
                    verification_details: { reason, document_url: documentUrl, requested_at: new Date().toISOString() }
                })
                .eq('id', userId);

            if (error) throw error;

            setStatus('pending');
            setMessage({ text: "Request submitted successfully! We'll review it soon.", type: "success" });
        } catch (error: any) {
            console.error("Error submitting verification:", error);
            setMessage({ text: "Gadbad! Submission failed.", type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Verification Badge</h1>
                        <p className="text-zinc-500 text-xs mt-1">Get the blue checkmark on your profile.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="glass p-8 rounded-[32px] border-premium shadow-premium-lg space-y-8">

                        {status === 'verified' ? (
                            <div className="text-center py-10 space-y-4">
                                <div className="w-20 h-20 bg-blue-500/20 border border-blue-500/40 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                    <BadgeCheck className="w-12 h-12 text-blue-400" />
                                </div>
                                <h2 className="text-2xl font-display font-black text-white uppercase tracking-widest">Aap Verified Hain!</h2>
                                <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                                    Mubarak ho! Aapka account verified hai aur system mein aapki identity confirmed hai.
                                </p>
                            </div>
                        ) : status === 'pending' ? (
                            <div className="text-center py-10 space-y-4">
                                <div className="w-20 h-20 bg-orange-500/20 border border-orange-500/40 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                    <Compass className="w-12 h-12 text-orange-400" />
                                </div>
                                <h2 className="text-2xl font-display font-black text-white uppercase tracking-widest">Request Pending</h2>
                                <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                                    Humne aapki request receive kar li hai. Hamari team ise jald hi review karegi.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="flex items-start gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                                    <ShieldAlert className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-bold text-blue-100">Verification Requirement</p>
                                        <p className="text-[11px] text-blue-300/80 leading-relaxed mt-1">
                                            Blue badge paane ke liye aapko ek valid reason dena hoga. Hum public figures, creators aur active citizens ko priority dete hain.
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {message.text && (
                                        <div className={`text-xs p-3 rounded-xl border font-bold text-center ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                                            {message.text}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 pl-1">
                                            <FileText className="w-3.5 h-3.5" /> Kyun Verify Hona Chahte Hain?
                                        </label>
                                        <textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="Write about yourself, your work, or public presence..."
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:border-primary/50 transition-all min-h-[120px] resize-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 pl-1">
                                            Document Link (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={documentUrl}
                                            onChange={(e) => setDocumentUrl(e.target.value)}
                                            placeholder="https://link-to-your-id-or-portfolio.com"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:border-primary/50 transition-all"
                                        />
                                        <p className="text-[10px] text-zinc-600 italic pl-1">Aapka document privacy ke saath handle kiya jaayega.</p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-primary hover:bg-primary/90 text-black font-display font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 uppercase tracking-[0.2em] text-xs"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Submit Request</>}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Tip */}
                <p className="text-center text-zinc-600 text-[10px] font-mono uppercase tracking-[0.3em]">
                    ConnectSphere Verification System v1.0
                </p>
            </div>
        </div>
    );
}
