"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    Loader2,
    Filter,
    CheckCircle,
    Clock,
    AlertCircle,
    Map as MapIcon,
    History as HistoryIcon,
    User as UserIcon,
    ShieldCheck,
    Mail,
    MapPin,
    Camera,
    Type,
    Navigation,
    X,
    MessageSquare,
    ChevronRight,
    BarChart3,
    Search,
    ShieldAlert,
    Crosshair,
    ScanLine,
    Activity,
    Cpu
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { DeptTab, DepartmentNav } from "./department-nav";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from '@/components/layout/bottom-nav'
import { Toaster } from "sonner"

export function DepartmentDashboard() {
    const [reports, setReports] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [jurisdiction, setJurisdiction] = useState<string | null>(null);
    const [isSettingLocation, setIsSettingLocation] = useState(false);
    const [tempLocation, setTempLocation] = useState("");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [profileData, setProfileData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<DeptTab>("dashboard");

    // Status Modal State
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [newStatus, setNewStatus] = useState("");
    const [updateDesc, setUpdateDesc] = useState("");
    const [updateMedia, setUpdateMedia] = useState("");
    const [captureGeo, setCaptureGeo] = useState(true);

    useEffect(() => {
        const initDashboard = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profile?.role !== 'official') {
                    window.location.href = '/';
                    return;
                }

                if (profile?.assigned_area) {
                    setJurisdiction(profile.assigned_area);
                } else {
                    setIsSettingLocation(true);
                }
                setUserRole(profile?.role || null);
            } else {
                window.location.href = '/';
                return;
            }
            fetchReports();
            fetchHistory();
        };

        initDashboard();

        const channel = supabase
            .channel('realtime-reports')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reports' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        toast("🚨 INCIDENT DETECTED", {
                            description: "New report registered in sector.",
                            icon: <ShieldAlert className="text-red-500 w-5 h-5" />,
                            style: { background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'white' }
                        });
                        fetchReports();
                    } else if (payload.eventType === 'UPDATE') {
                        setReports((prev) =>
                            prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new } : r)
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [filter]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("reports")
                .select(`*, profiles (username, avatar_url, full_name)`)
                .order("created_at", { ascending: false });

            if (filter !== "all") {
                query = query.eq("status", filter);
            }

            const { data, error } = await query;
            setReports(data || []);
        } catch (err) {
            setReports([]);
        }
        setLoading(false);
    };

    const fetchHistory = async () => {
        try {
            const { data } = await supabase
                .from("report_updates")
                .select(`*, reports(title), profiles(full_name)`)
                .order("created_at", { ascending: false })
                .limit(20);
            setHistory(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSetJurisdiction = async () => {
        if (!tempLocation) return toast.error("Coordinate input required.");
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase.from('profiles').update({ assigned_area: tempLocation }).eq('id', user.id);
            if (!error) {
                setJurisdiction(tempLocation);
                setIsSettingLocation(false);
                toast.success(`SECTOR LOCKED: ${tempLocation.toUpperCase()}`);
            }
        } else {
            setJurisdiction(tempLocation);
            setIsSettingLocation(false);
            toast.success(`GUEST SECTOR LOCKED: ${tempLocation.toUpperCase()}`);
        }
    };

    const filteredReports = jurisdiction && jurisdiction !== "Guest View"
        ? reports.filter(r => r.address && r.address.toLowerCase().includes(jurisdiction.toLowerCase()))
        : reports;

    const stats = [
        { label: "Total Intercepts", value: reports.length, icon: Cpu, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", shadow: "shadow-[0_0_15px_rgba(34,211,238,0.2)]" },
        { label: "Pending Analysis", value: reports.filter(r => r.status === 'under_review').length, icon: ScanLine, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", shadow: "shadow-[0_0_15px_rgba(251,191,36,0.2)]" },
        { label: "Active Operations", value: reports.filter(r => r.status === 'working').length, icon: Activity, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", shadow: "shadow-[0_0_15px_rgba(168,85,247,0.2)]" },
        { label: "Tactical Success", value: reports.filter(r => r.status === 'completed').length, icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", shadow: "shadow-[0_0_15px_rgba(16,185,129,0.2)]" },
    ];

    const openUpdateModal = (report: any, status: string) => {
        setSelectedReport(report);
        setNewStatus(status);
        setUpdateDesc("");
        setUpdateMedia("");
        setIsUpdateModalOpen(true);
    };

    const submitStatusUpdate = async () => {
        if (!updateDesc) return toast.error("Action descriptor required.");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        toast.loading("Transmitting to mainframe... 📡");

        let lat = null;
        let lng = null;

        if (captureGeo) {
            lat = selectedReport.latitude + (Math.random() * 0.001); // Mock precision
            lng = selectedReport.longitude + (Math.random() * 0.001);
        }

        const { error: updateError } = await supabase
            .from("reports")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", selectedReport.id);

        if (updateError) {
            toast.dismiss();
            return toast.error("Uplink Failed. Retrying...");
        }

        const { error: historyError } = await supabase.from("report_updates").insert({
            report_id: selectedReport.id,
            official_id: user.id,
            new_status: newStatus,
            description: updateDesc,
            media_urls: updateMedia ? [updateMedia] : [],
            latitude: lat,
            longitude: lng
        });

        toast.dismiss();
        if (historyError) {
            toast.error("Status updated, but telemetry log failed.");
        } else {
            toast.success(`OVERRIDE ACCEPTED: ${newStatus.toUpperCase()}`);
        }

        setIsUpdateModalOpen(false);
        fetchReports();
        fetchHistory();
    };

    return (
        <div className="min-h-screen bg-[#030613] text-cyan-50 pb-32 selection:bg-cyan-500/40 relative overflow-hidden font-sans">
            {/* Cyberpunk Grid & Ambient Glow Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-600/10 blur-[140px] rounded-full animate-pulse-slow mix-blend-screen" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full animation-delay-4000 mix-blend-screen" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,#030613_80%)]" />
            </div>

            {/* Tactical HUD Header */}
            <header className="sticky top-0 z-50 px-4 md:px-8 py-4 backdrop-blur-2xl bg-[#030613]/80 border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(6,182,212,0.1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 relative z-10">
                    <motion.div
                        whileHover={{ rotate: 90 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)] backdrop-blur-md"
                    >
                        <Crosshair className="text-cyan-400 w-6 h-6 animate-pulse" />
                    </motion.div>
                    <div>
                        <h1 className="text-2xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 tracking-tightest flex items-center gap-3 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                            DASH-PRIME
                            <span className="flex items-center gap-1.5 bg-red-500/10 text-red-400 text-[9px] font-mono px-2 py-0.5 rounded border border-red-500/30 uppercase tracking-widest relative overflow-hidden">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping absolute left-1.5" />
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 relative z-10 mr-0.5" />
                                LIVE SECURE
                            </span>
                        </h1>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-200/60 uppercase tracking-widest mt-1">
                            <MapPin className="w-3 h-3 text-cyan-500" />
                            <span>NODE: {jurisdiction || "GLOBAL"}</span>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsSettingLocation(true)}
                                className="text-purple-400 hover:text-cyan-300 transition-colors ml-2 underline decoration-purple-500/40 underline-offset-4"
                            >
                                RECALIBRATE
                            </motion.button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 relative z-10">
                    {['all', 'pending', 'working', 'completed'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-300 border backdrop-blur-md",
                                filter === f
                                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                                    : "bg-white/5 border-white/10 text-slate-500 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-100"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 relative z-10">
                {activeTab === 'dashboard' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        {/* High-Tech Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            {stats.map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                                    className={cn(
                                        "relative group overflow-hidden rounded-[2rem] p-5 md:p-6 bg-[#060a1f]/60 backdrop-blur-xl border border-white/5 hover:border-cyan-500/50 transition-all duration-500",
                                        stat.shadow
                                    )}
                                >
                                    {/* Animated Glint */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[200%] group-hover:animate-[glint_1s_forwards]" />

                                    <div className="flex flex-col gap-4 relative z-10">
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform duration-500 group-hover:scale-110", stat.bg, stat.border)}>
                                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-1 drop-shadow-md">{stat.label}</p>
                                            <p className={cn("text-4xl font-black tracking-tighter drop-shadow-lg", stat.color)}>{stat.value}</p>
                                        </div>
                                    </div>
                                    {/* Corner Accents */}
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/10 rounded-tl-xl group-hover:border-cyan-500/50 transition-colors" />
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/10 rounded-br-xl group-hover:border-cyan-500/50 transition-colors" />
                                </motion.div>
                            ))}
                        </div>

                        {/* Tactical Incident Feed */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
                                <h2 className="text-xl font-black text-cyan-50 flex items-center gap-3 uppercase tracking-widest drop-shadow-md">
                                    <ScanLine className="w-5 h-5 text-cyan-400" />
                                    Live Intel Feed
                                </h2>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded border border-cyan-500/30 uppercase tracking-widest">
                                    <Activity className="w-3 h-3 animate-pulse" />
                                    FILTER: {filter}
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-32 gap-6">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full border-2 border-cyan-900 border-t-cyan-400 animate-[spin_1.5s_linear_infinite] shadow-[0_0_30px_rgba(34,211,238,0.2)]" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Cpu className="w-8 h-8 text-cyan-500 animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="text-cyan-400 font-mono text-xs uppercase tracking-[0.4em] animate-pulse">Decrypting Packages...</p>
                                </div>
                            ) : filteredReports.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-[#060a1f]/40 border border-emerald-500/20 rounded-[3rem] p-24 text-center relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.05)]"
                                >
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />
                                    <div className="relative z-10 w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/30 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                        <ShieldCheck className="w-12 h-12 text-emerald-400" />
                                    </div>
                                    <h3 className="relative z-10 text-2xl font-black text-emerald-300 uppercase tracking-widest drop-shadow-lg">Sector Cleared</h3>
                                    <p className="relative z-10 text-emerald-500/60 font-mono text-sm max-w-md mx-auto mt-4 uppercase tracking-widest leading-relaxed">No anomalies detected in the current grid. Maintain standard patrol protocols.</p>
                                </motion.div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <AnimatePresence mode="popLayout">
                                        {filteredReports.map((report, idx) => (
                                            <motion.div
                                                key={report.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                                                transition={{
                                                    delay: idx * 0.05,
                                                    type: "spring",
                                                    stiffness: 200,
                                                    damping: 20
                                                }}
                                                className="relative group bg-[#060a1f]/60 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden hover:border-cyan-500/50 transition-colors duration-500 shadow-xl"
                                            >
                                                {/* Dossier Image Header */}
                                                <div className="relative h-48 bg-black overflow-hidden">
                                                    {report.media_urls?.[0] ? (
                                                        <img src={report.media_urls[0]} alt="Evidence" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-100 transition-all duration-1000 opacity-60 mix-blend-luminosity hover:mix-blend-normal" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black p-4 text-center">
                                                            <ScanLine className="w-12 h-12 text-cyan-900 group-hover:text-cyan-500 group-hover:rotate-90 transition-all duration-1000 mb-2" />
                                                            <span className="text-[10px] font-mono text-cyan-900 uppercase tracking-[0.3em]">No Visual Evidence</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#060a1f] via-[#060a1f]/40 to-transparent" />

                                                    {/* Scanner Line Animation */}
                                                    <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400/50 blur-[2px] opacity-0 group-hover:opacity-100 group-hover:animate-[scan_2s_ease-in-out_infinite]" />

                                                    {/* Status Badge */}
                                                    <div className="absolute top-4 left-4 z-10">
                                                        <span className={cn(
                                                            "px-3 py-1.5 rounded border text-[9px] font-black uppercase tracking-[0.2em] backdrop-blur-md shadow-2xl flex items-center gap-1.5",
                                                            report.status === 'completed' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                                                                report.status === 'working' ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' :
                                                                    'bg-red-500/20 border-red-500/50 text-red-400'
                                                        )}>
                                                            <div className={cn(
                                                                "w-1.5 h-1.5 rounded-full animate-pulse",
                                                                report.status === 'completed' ? 'bg-emerald-400' : report.status === 'working' ? 'bg-purple-400' : 'bg-red-400'
                                                            )} />
                                                            {report.status}
                                                        </span>
                                                    </div>

                                                    {/* Location Badge */}
                                                    <div className="absolute bottom-4 left-4 right-4 z-10">
                                                        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded border border-white/10 w-fit max-w-full">
                                                            <div className="p-1 bg-cyan-500/20 rounded">
                                                                <Crosshair className="w-3 h-3 text-cyan-400" />
                                                            </div>
                                                            <span className="text-[10px] font-mono text-cyan-100 truncate tracking-wider">{report.address}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-6 pb-20 md:pb-6 space-y-5">
                                                    <div>
                                                        <h3 className="font-bold text-white text-lg group-hover:text-cyan-400 transition-colors line-clamp-1 tracking-tight drop-shadow-md">{report.title}</h3>
                                                        <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed font-sans">{report.description}</p>
                                                    </div>

                                                    <div className="flex items-center justify-between py-4 border-y border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="w-8 h-8 rounded shrink-0 border border-white/10 opacity-80 group-hover:opacity-100">
                                                                <AvatarImage src={report.profiles?.avatar_url} />
                                                                <AvatarFallback className="bg-slate-900 text-[10px] text-cyan-500 uppercase rounded">{report.profiles?.username?.substring(0, 2) || "??"}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <span className="block text-[10px] font-mono text-cyan-500/50 uppercase tracking-widest mb-0.5">Reporter ID</span>
                                                                <span className="block text-[11px] font-bold text-slate-300 drop-shadow-sm truncate max-w-[120px]">@{report.profiles?.username || "unknown_entity"}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-[10px] font-mono text-cyan-500/50 uppercase tracking-widest mb-0.5">Timestamp</span>
                                                            <span className="block text-[10px] font-black tracking-widest text-slate-500">
                                                                {new Date(report.created_at).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="pt-2">
                                                        {report.status === 'pending' && (
                                                            <button
                                                                onClick={() => openUpdateModal(report, 'accepted')}
                                                                className="w-full bg-cyan-950/30 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group/btn shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                                                            >
                                                                Initiate Protocol <ChevronRight className="w-3.5 h-3.5 text-cyan-500 group-hover/btn:translate-x-1.5 transition-transform" />
                                                            </button>
                                                        )}
                                                        {report.status === 'accepted' && (
                                                            <button
                                                                onClick={() => openUpdateModal(report, 'working')}
                                                                className="w-full bg-purple-900/40 hover:bg-purple-700/60 border border-purple-500/40 hover:border-purple-400 text-purple-200 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group/btn shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                                                            >
                                                                Deploy Units <ChevronRight className="w-3.5 h-3.5 text-purple-400 group-hover/btn:translate-x-1.5 transition-transform" />
                                                            </button>
                                                        )}
                                                        {report.status === 'working' && (
                                                            <button
                                                                onClick={() => openUpdateModal(report, 'completed')}
                                                                className="w-full bg-emerald-900/40 hover:bg-emerald-600/80 border border-emerald-500/40 hover:border-emerald-400 text-emerald-100 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group/btn shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                                                            >
                                                                Confirm Resolution <CheckCircle className="w-3.5 h-3.5 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                                                            </button>
                                                        )}
                                                        {report.status === 'completed' && (
                                                            <div className="w-full bg-slate-900/50 border border-emerald-500/20 text-emerald-600/60 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] text-center flex items-center justify-center gap-2 disabled cursor-not-allowed">
                                                                <ShieldCheck className="w-4 h-4" /> CASE CLOSED
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'heatmap' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <div className="h-[60vh] min-h-[500px] bg-[#02040a] rounded-[3rem] border border-cyan-500/20 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                            {/* 3D Radar Grid Simulation */}
                            <div className="absolute inset-0 [transform:rotateX(60deg)_scale(2)] [transform-origin:center_center] bg-[linear-gradient(rgba(34,211,238,0.1)_2px,transparent_2px),linear-gradient(90deg,rgba(34,211,238,0.1)_2px,transparent_2px)] bg-[size:50px_50px] [perspective:1000px] pointer-events-none" />

                            {/* Sweeping Radar Line */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[conic-gradient(from_0deg_at_50%_50%,rgba(34,211,238,0)_0deg,rgba(34,211,238,0.3)_360deg)] rounded-full animate-[spin_4s_linear_infinite] pointer-events-none mix-blend-screen" border-cyan-500 border-r-2 />

                            {/* Radar Rings */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-cyan-500/20 rounded-full" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-cyan-500/10 rounded-full" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] border border-cyan-500/5 rounded-full" />

                            {/* Center Node */}
                            <div className="relative z-10 p-6 bg-cyan-950/80 backdrop-blur-md rounded-2xl border border-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.5)] mb-8">
                                <Crosshair className="w-16 h-16 text-cyan-300 animate-[spin_10s_linear_infinite]" />
                            </div>

                            <h2 className="relative z-10 text-3xl font-black text-white uppercase tracking-[0.3em] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mb-4">Tactical Radar</h2>
                            <p className="relative z-10 text-cyan-200/60 font-mono text-sm uppercase tracking-widest max-w-md bg-black/60 p-3 rounded backdrop-blur border border-white/5">
                                Scanning sector: {jurisdiction}
                            </p>

                            <div className="relative z-10 mt-12 grid grid-cols-2 gap-6 w-full max-w-lg">
                                <div className="bg-[#060a1f]/80 backdrop-blur-xl p-5 rounded-2xl border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.15)] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors" />
                                    <p className="text-[10px] text-red-500/80 uppercase font-black tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Critical Zones
                                    </p>
                                    <p className="text-3xl font-black text-red-400 tracking-tighter drop-shadow-lg">12</p>
                                </div>
                                <div className="bg-[#060a1f]/80 backdrop-blur-xl p-5 rounded-2xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
                                    <p className="text-[10px] text-emerald-500/80 uppercase font-black tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Avg Response
                                    </p>
                                    <p className="text-3xl font-black text-emerald-400 tracking-tighter drop-shadow-lg">2.4<span className="text-lg">h</span></p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-8 pb-20"
                    >
                        <div className="flex items-center justify-between border-b border-purple-500/20 pb-4">
                            <h2 className="text-2xl font-black text-purple-100 uppercase flex items-center gap-3 tracking-[0.2em] drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                                <HistoryIcon className="w-6 h-6 text-purple-400" />
                                Secure Intel Logs
                            </h2>
                            <div className="px-4 py-1.5 bg-purple-950/40 border border-purple-500/30 rounded text-[10px] font-mono font-bold text-purple-300 uppercase tracking-widest backdrop-blur-sm">
                                Entries: {history.length}
                            </div>
                        </div>

                        <div className="space-y-4 relative before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-[2px] before:bg-gradient-to-b before:from-purple-500/80 before:via-purple-900 before:to-transparent">
                            {history.length === 0 ? (
                                <div className="bg-[#060a1f]/40 border border-purple-500/20 rounded-[2rem] p-24 text-center">
                                    <HistoryIcon className="w-12 h-12 text-purple-500/30 mx-auto mb-6" />
                                    <p className="text-purple-300/60 font-mono text-sm uppercase tracking-[0.4em] drop-shadow-md">Awaiting initial telemetry...</p>
                                </div>
                            ) : (
                                history.map((item, idx) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={item.id}
                                        className="relative pl-16 group"
                                    >
                                        <div className="absolute left-3 top-6 w-8 h-8 rounded-sm bg-[#060a1f] border border-purple-500/50 flex items-center justify-center z-10 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.3)] rotate-45">
                                            <div className="w-2 h-2 bg-purple-400 shadow-[0_0_10px_rgba(255,255,255,0.8)] -rotate-45" />
                                        </div>

                                        <div className="bg-[#060a1f]/60 backdrop-blur-md rounded-2xl p-6 border border-white/5 group-hover:border-purple-500/40 transition-all duration-300 shadow-lg font-mono">
                                            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
                                                <div>
                                                    <p className="text-xs text-purple-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                                                        <span className="w-2 h-1 bg-purple-500 inline-block" />
                                                        Ref: {item.reports?.title.substring(0, 20)}...
                                                    </p>
                                                    <p className="text-sm font-sans text-slate-200 leading-relaxed font-medium">{item.description}</p>
                                                </div>
                                                <div className="shrink-0 bg-black/80 border border-purple-500/20 px-3 py-2 rounded text-[10px] text-purple-200 tracking-widest flex items-center gap-2">
                                                    <Clock className="w-3 h-3 text-purple-500" />
                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} HRS
                                                </div>
                                            </div>

                                            {item.media_urls?.[0] && (
                                                <div className="mb-6 rounded-xl overflow-hidden border border-white/10 relative h-40 max-w-sm group/media">
                                                    <img src={item.media_urls[0]} alt="Log Media" className="w-full h-full object-cover opacity-50 group-hover/media:opacity-100 transition-all duration-500 grayscale group-hover/media:grayscale-0" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#060a1f] via-transparent to-transparent pointer-events-none" />
                                                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[9px] font-black text-red-400 uppercase tracking-widest border border-red-500/30 flex items-center gap-1.5">
                                                        <Camera className="w-3 h-3" /> INTEL ATTACHED
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="w-8 h-8 rounded border border-purple-500/30">
                                                        <AvatarImage src={item.profiles?.avatar_url} />
                                                        <AvatarFallback className="bg-slate-900 text-[10px] text-purple-500 font-sans">{item.profiles?.full_name?.substring(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-300 font-sans tracking-wide uppercase">{item.profiles?.full_name}</p>
                                                        <p className="text-[9px] text-purple-500/60 uppercase tracking-[0.2em] font-bold">Authorized Operative</p>
                                                    </div>
                                                </div>
                                                {item.latitude ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/50 border border-emerald-500/30 rounded text-[9px] font-bold text-emerald-400 uppercase tracking-[0.1em]">
                                                        <MapPin className="w-3 h-3" /> GEO-SYNCED: [{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}]
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest px-3 py-1.5 bg-black rounded border border-white/5">No Coordinates</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'profile' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-2xl mx-auto py-8 space-y-8"
                    >
                        <div className="bg-[#060a1f]/80 backdrop-blur-2xl rounded-[3rem] p-8 md:p-12 text-center relative overflow-hidden border border-cyan-500/20 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-cyan-600/20 to-transparent blur-[80px] rounded-b-full pointer-events-none" />

                            <div className="relative inline-block mb-8">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="relative z-10 p-2 bg-[#030613] rounded-3xl border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.3)] shrink-0 inline-block"
                                >
                                    <Avatar className="w-32 h-32 rounded-2xl">
                                        <AvatarImage src={profileData?.avatar_url} />
                                        <AvatarFallback className="bg-slate-900 border border-cyan-900 text-4xl font-black text-cyan-400">{profileData?.full_name?.[0]}</AvatarFallback>
                                    </Avatar>
                                </motion.div>
                                <div className="absolute -bottom-4 -right-4 p-3 bg-emerald-500 rounded-xl border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] z-20 flex items-center justify-center">
                                    <ShieldCheck className="w-6 h-6 text-emerald-950" />
                                </div>
                            </div>

                            <h2 className="text-4xl font-black text-white tracking-tighter drop-shadow-lg relative z-10">{profileData?.full_name || "GUEST OPERATOR"}</h2>
                            <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 bg-cyan-950/60 border border-cyan-500/30 rounded font-mono text-xs uppercase tracking-[0.3em] text-cyan-300 relative z-10 shadow-lg">
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                                {profileData?.username || "SYS_ADMIN"}
                            </div>

                            <div className="mt-12 grid grid-cols-1 gap-4 relative z-10">
                                <div className="flex items-center gap-5 bg-black/40 backdrop-blur pb-6 p-5 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all text-left group">
                                    <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform"><MapPin className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-1">Assigned Grid</p>
                                        <p className="text-xl font-black text-cyan-50 tracking-tight">{jurisdiction}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-5 bg-black/40 backdrop-blur p-5 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all text-left group">
                                    <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform"><Navigation className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-1">Clearance Level</p>
                                        <p className="text-xl font-black text-purple-50 tracking-tight">{profileData?.department || "Central Cmd"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 grid grid-cols-1 gap-4 relative z-10">
                                <button
                                    onClick={() => supabase.auth.signOut().then(() => window.location.href = '/role-selection')}
                                    className="bg-red-950/50 border border-red-500/30 text-red-400 font-black py-4 rounded-xl hover:bg-red-900/80 hover:text-red-300 transition-all text-xs uppercase tracking-[0.2em] shadow-[0_4px_20px_rgba(239,68,68,0.1)] active:scale-95"
                                >
                                    Terminate Session
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Tactical Override Modal */}
            <AnimatePresence>
                {isUpdateModalOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
                            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            onClick={() => setIsUpdateModalOpen(false)}
                            className="absolute inset-0 bg-[#030613]/80"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 30 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="relative bg-[#060a1f] w-full max-w-lg rounded-[2.5rem] border border-cyan-500/30 p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)] overflow-hidden"
                        >
                            {/* Modal Background Accents */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

                            <div className="relative z-10 flex justify-between items-center mb-8 border-b border-white/10 pb-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                                        <ShieldAlert className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md">System Override</h2>
                                        <p className="text-[10px] text-cyan-400 font-mono uppercase tracking-[0.2em] mt-1 shadow-sm">Target: {selectedReport.title.substring(0, 25)}...</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsUpdateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                            </div>

                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center justify-between p-4 bg-black/60 rounded-2xl border border-white/5 shadow-inner">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Executing Phase:</span>
                                    <span className="px-4 py-1.5 bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-black tracking-widest rounded shadow-[0_0_10px_rgba(34,211,238,0.3)] uppercase">{newStatus}</span>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-cyan-400/80 mb-2 uppercase tracking-[0.2em]">
                                        <Type className="w-3.5 h-3.5" /> Action Parameter [Required]
                                    </label>
                                    <textarea
                                        value={updateDesc}
                                        onChange={(e) => setUpdateDesc(e.target.value)}
                                        placeholder="Input tactical directive..."
                                        className="w-full bg-black/80 backdrop-blur border border-white/10 focus:border-cyan-500 rounded-2xl p-5 text-sm outline-none min-h-[140px] text-cyan-50 placeholder:text-slate-700 font-mono transition-colors shadow-inner"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-cyan-400/80 mb-2 uppercase tracking-[0.2em]">
                                        <Camera className="w-3.5 h-3.5" /> External Intel Link [Optional]
                                    </label>
                                    <input
                                        value={updateMedia}
                                        onChange={(e) => setUpdateMedia(e.target.value)}
                                        placeholder="https://secure-vault.gov/evidence.jpg"
                                        className="w-full bg-black/80 backdrop-blur border border-white/10 focus:border-cyan-500 rounded-xl px-5 py-4 text-sm outline-none text-cyan-50 placeholder:text-slate-700 font-mono transition-colors shadow-inner"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-5 bg-black/60 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400"><MapPin className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-widest">Enable Telemetry</p>
                                            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.1em] mt-0.5">Attach GPS meta-data</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCaptureGeo(!captureGeo)}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-colors relative border",
                                            captureGeo ? "bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-slate-900 border-slate-700"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-md",
                                            captureGeo ? "left-7" : "left-1 border border-slate-600"
                                        )} />
                                    </button>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={submitStatusUpdate}
                                    className="w-full mt-4 border border-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-50 font-black py-5 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all text-xs uppercase tracking-[0.3em]"
                                >
                                    Transmit Authorization 🛡️
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Recalibrate Modal */}
            <AnimatePresence>
                {isSettingLocation && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
                            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            onClick={() => jurisdiction && setIsSettingLocation(false)}
                            className="absolute inset-0 bg-[#030613]/80"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 30 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="relative bg-[#060a1f] w-full max-w-md rounded-[2rem] border border-purple-500/30 p-8 shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

                            <div className="relative z-10 space-y-8">
                                <div className="text-center space-y-4">
                                    <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center mx-auto border border-purple-500/30 mb-2 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                                        <ScanLine className="text-purple-400 w-10 h-10 animate-pulse" />
                                    </div>
                                    <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-md">Sector Sync</h2>
                                    <p className="text-purple-200/60 font-mono text-xs uppercase tracking-widest">Establish monitoring jurisdiction</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="relative">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-purple-500 w-5 h-5 animate-pulse" />
                                        <input
                                            placeholder="Enter coordinates or city..."
                                            className="w-full bg-black/60 shadow-inner border border-purple-500/30 rounded-2xl pl-12 pr-5 py-5 focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none text-white transition-all font-mono placeholder:text-slate-700"
                                            autoFocus
                                            value={tempLocation}
                                            onChange={(e) => setTempLocation(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {jurisdiction && (
                                            <button
                                                onClick={() => setIsSettingLocation(false)}
                                                className="py-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all font-mono"
                                            >
                                                Abort
                                            </button>
                                        )}
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleSetJurisdiction}
                                            className={cn(
                                                "bg-purple-600/20 border border-purple-400 hover:bg-purple-600/40 text-purple-100 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all",
                                                !jurisdiction && "col-span-2"
                                            )}
                                        >
                                            Lock Coordinates
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <DepartmentNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );
}
