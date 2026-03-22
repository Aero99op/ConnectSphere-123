"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StitchQuixCard } from "./stitch-quix-card";

export default function StitchQuix() {
    const { supabase, user } = useAuth();
    const [quixList, setQuixList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialId = searchParams.get('id');

    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchQuix = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from("quix")
                .select(`
                    *,
                    profiles!quix_user_id_fkey (username, avatar_url, full_name, id)
                `)
                .order("created_at", { ascending: false });

            if (!error && data) {
                setQuixList(data);
            }
            setLoading(false);
        };

        fetchQuix();
    }, [supabase]);

    useEffect(() => {
        if (initialId && quixList.length > 0 && containerRef.current) {
            const index = quixList.findIndex(q => q.id === initialId);
            if (index !== -1) {
                setActiveIndex(index);
                containerRef.current.scrollTo({
                    top: index * containerRef.current.clientHeight,
                    behavior: 'instant'
                });
            }
        }
    }, [initialId, quixList]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (index !== activeIndex) {
            setActiveIndex(index);
        }
    };

    return (
        <div className="bg-[#0c0e12] text-[#f8f9fe] font-body selection:bg-[#ba9eff]/30 selection:text-white overflow-hidden min-h-screen">
            <style dangerouslySetInnerHTML={{ __html: `
                .font-headline { font-family: 'Plus Jakarta Sans', sans-serif; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />

            {/* SideNavBar */}
            <aside className="fixed left-0 top-0 h-full z-50 hidden md:flex flex-col p-6 w-64 border-r border-white/10 bg-[#0c0e12]/80 backdrop-blur-2xl shadow-[40px_0_40px_rgba(139,92,246,0.05)]">
                <div className="mb-12 cursor-pointer" onClick={() => router.push('/')}>
                    <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#ba9eff] to-[#8455ef]">Quix</h1>
                    <p className="font-headline tracking-tight font-bold text-xs text-slate-500 uppercase mt-1">Elite Social</p>
                </div>
                <nav className="flex flex-col space-y-2 flex-grow">
                    <Link href="/" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        <span>Home</span>
                    </Link>
                    <Link href="/search" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <span>Search</span>
                    </Link>
                    <div className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-[#ba9eff] bg-white/5 rounded-xl border-l-4 border-[#53ddfc] transition-all duration-300 group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform fill-current" viewBox="0 0 24 24"><path d="M4 6h16v12H4z" fill="currentColor" fillOpacity="0.2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        <span>Quix</span>
                    </div>
                    <Link href="/create" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span>Create</span>
                    </Link>
                    <Link href="/report" className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                        <span>Report</span>
                    </Link>
                    <Link href={`/profile/${user?.id}`} className="flex items-center space-x-4 p-3 font-headline tracking-tight font-bold text-sm text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl group">
                        <svg className="w-6 h-6 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span>Profile</span>
                    </Link>
                </nav>
            </aside>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 w-full h-16 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4 z-50">
                <Link href="/" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></Link>
                <Link href="/search" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></Link>
                <Link href="/create" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></Link>
                <Link href="/quix" className="text-[#53ddfc] scale-105 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v12H4z" fill="currentColor" fillOpacity="0.2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></Link>
                <Link href={`/profile/${user?.id}`} className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></Link>
            </div>

            {/* Main Content Area (Video Feed) */}
            <main className="md:ml-64 h-screen bg-black relative flex justify-center pb-16 md:pb-0">
                {/* Top AppBar Integration */}
                <header className="fixed top-0 md:left-64 right-0 z-40 flex justify-center items-center px-4 md:px-8 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                    <div className="flex space-x-8 pointer-events-auto">
                        <div className="text-lg md:text-xl font-black text-[#53ddfc] transition-opacity relative cursor-pointer drop-shadow-lg">
                            Following
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#ff86c3]"></span>
                        </div>
                        <div className="text-lg md:text-xl font-black text-white/70 hover:opacity-100 transition-opacity cursor-pointer drop-shadow-lg">
                            For You
                        </div>
                    </div>
                </header>

                <div 
                    ref={containerRef}
                    className="w-full max-w-lg h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar z-10"
                    onScroll={handleScroll}
                >
                    {loading ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 animate-spin text-[#ba9eff]" />
                        </div>
                    ) : quixList.length === 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center text-[#a9abb0]">
                            <h3 className="text-lg font-headline font-bold uppercase tracking-widest text-[#ba9eff]">Empty Dimension</h3>
                            <p className="font-mono text-sm mt-2">No Quix exist in this reality yet.</p>
                        </div>
                    ) : (
                        quixList.map((quix, index) => (
                            <StitchQuixCard key={quix.id} quix={quix} isActive={index === activeIndex} />
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
