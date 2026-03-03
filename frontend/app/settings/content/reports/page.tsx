"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Compass, Clock, CheckCircle2, AlertCircle, Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReportsSettingsPage() {
    const { user: authUser, supabase } = useAuth();
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchMyReports() {
            try {
                if (!authUser) { setIsLoading(false); return; }
                const { data, error } = await supabase
                    .from('reports')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .order('created_at', { ascending: false });

                if (data) setReports(data);
            } catch (error) {
                console.error("Error fetching reports:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchMyReports();
    }, [authUser, supabase]);

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'completed': return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", label: "Fixed" };
            case 'working': return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "In Progress" };
            default: return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Pending" };
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] opacity-30" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">My Civic Reports</h1>
                        <p className="text-zinc-500 text-xs mt-1">Aapki shikayaton ki progress dekho.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reports.length > 0 ? (
                            reports.map((report) => {
                                const config = getStatusConfig(report.status);
                                return (
                                    <div key={report.id} className="glass p-5 rounded-[2rem] border-premium shadow-premium-sm group hover:border-white/10 transition-all">
                                        <div className="flex gap-4">
                                            <div className="w-20 h-20 bg-zinc-800 rounded-2xl overflow-hidden shrink-0 border border-white/5">
                                                {report.media_urls?.[0] ? (
                                                    <img src={report.media_urls[0]} alt="Report" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-2xl">🚧</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="text-sm font-bold text-white truncate">{report.title}</h3>
                                                    <div className={`px-2 py-1 rounded-full border ${config.bg} ${config.border} flex items-center gap-1 shrink-0`}>
                                                        <config.icon className={`w-3 h-3 ${config.color}`} />
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-zinc-400 font-medium mb-3 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-red-400" /> {report.address || "Location Hidden"}
                                                </p>
                                                <div className="flex items-center justify-between mt-auto">
                                                    <span className="text-[9px] font-mono text-zinc-600 uppercase bg-white/5 px-2 py-0.5 rounded">ID: {report.id.slice(0, 8)}</span>
                                                    <span className="text-[9px] text-zinc-500 font-medium">{new Date(report.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="glass p-16 rounded-[2.5rem] text-center border-premium border-dashed opacity-50">
                                <div className="text-4xl mb-4">🙌</div>
                                <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500">Sab Sahi Hai!</h3>
                                <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest mt-2">Aapne abhi tak koyi report submit nahi ki hai.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
