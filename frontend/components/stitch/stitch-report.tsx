"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2, Camera, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { uploadToCatbox } from "@/lib/upload";
import { cn, sanitizeInput } from "@/lib/utils";
import Link from "next/link";

function StitchReportContent() {
    const { user: authUser, supabase } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [type, setType] = useState("");
    const [description, setDescription] = useState("");
    const [address, setAddress] = useState("");
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);

    const issueTypes = [
        { id: 'pothole', label: 'Pothole/Road', icon: '🚧' },
        { id: 'garbage', label: 'Garbage Dump', icon: '🗑️' },
        { id: 'water', label: 'Water Leakage', icon: '💧' },
        { id: 'electricity', label: 'Street Light', icon: '💡' },
        { id: 'traffic', label: 'Traffic/Parking', icon: '🚦' },
        { id: 'other', label: 'Other', icon: '📢' },
    ];

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);

            const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
            setPreviewUrls(prev => [...prev, ...newPreviewUrls]);

            setLoading(true);
            const uploadToast = toast.loading("Uploading evidence securely...");

            try {
                const uploadedUrls = await Promise.all(newFiles.map(file => uploadToCatbox(file)));
                setUploadedMediaUrls(prev => [...prev, ...uploadedUrls]);

                toast.dismiss(uploadToast);
                toast.success("Evidence secured!");
            } catch (error: any) {
                console.error("Catbox upload error:", error);
                toast.dismiss(uploadToast);
                toast.error("Upload failed: " + error.message);
                toast.warning("Proceeding with local previews only.");
            } finally {
                setLoading(false);
            }
        }
    };

    const detectLocation = async () => {
        toast.loading("Detecting coordinates...");

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setAddress(`GPS Location (Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)})`);
                    toast.dismiss();
                    toast.success("Coordinates acquired! 🛰️");
                },
                async (error) => {
                    console.warn("GPS Failed, trying IP...", error);
                    await fetchIpLocation();
                },
                { timeout: 5000, enableHighAccuracy: true }
            );
        } else {
            await fetchIpLocation();
        }
    };

    const fetchIpLocation = async () => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();

            if (data.latitude && data.longitude) {
                setLocation({
                    lat: data.latitude,
                    lng: data.longitude
                });
                setAddress(`${data.city}, ${data.region}, ${data.country_name} (IP Based)`);
                toast.dismiss();
                toast.success("Network Location Detected! 🌐");
            } else {
                throw new Error("No location data in response");
            }
        } catch (error) {
            console.error("Location Error:", error);
            toast.dismiss();
            toast.error("Could not detect location. Please enter manually.");
        }
    };

    const handleSubmit = async () => {
        if (!type || !description || !location) {
            toast.error("Please fill all required fields and detect location.");
            return;
        }

        setLoading(true);

        try {
            if (authUser?.email === "guest@connectsphere.com") {
                toast.error("Oops! Guests can't submit reports.", {
                    description: "Create a verified account to help your community!"
                });
                setLoading(false);
                return;
            }

            const { error } = await supabase.from('reports').insert({
                user_id: authUser?.id || null,
                title: `${type.toUpperCase()} Issue`,
                description: sanitizeInput(description),
                type,
                media_urls: uploadedMediaUrls.length > 0 ? uploadedMediaUrls : previewUrls,
                latitude: location.lat,
                longitude: location.lng,
                address: sanitizeInput(address),
                status: 'pending'
            });

            if (error) throw error;

            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: 'reports-updates',
                    event: 'report-new',
                    data: { userId: authUser?.id }
                })
            }).catch(e => console.error("Apinator trigger failed", e));

            toast.success("Report Submitted! Authorities notified via Stitch.");
            router.push('/profile');

        } catch (e) {
            console.error(e);
            toast.error("Failed to submit report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#0c0e12] text-[#f8f9fe] font-body selection:bg-[#ba9eff]/30 min-h-screen overflow-x-hidden">
            <style dangerouslySetInnerHTML={{ __html: `
                .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); }
                .ethereal-glow { box-shadow: 0 0 40px rgba(139, 92, 246, 0.15); }
                .text-gradient-primary { background: linear-gradient(to right, #ba9eff, #8455ef); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .font-headline { font-family: 'Outfit', sans-serif; }
            `}} />

            {/* Sidebar Navigation Shell */}
            <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 border-r border-white/10 bg-[#0c0e12] py-8 z-50">
                <div className="px-6 mb-12">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ba9eff] to-[#8455ef] flex items-center justify-center shadow-lg shadow-[#ba9eff]/20">
                            <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/></svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-[#ba9eff] font-headline tracking-tighter">Connect</h1>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Civic Hub</p>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-3 space-y-1">
                    <Link href="/" className="flex items-center gap-4 text-slate-500 py-3 px-6 hover:bg-white/5 hover:text-[#53ddfc] transition-all duration-300 rounded-r-full group">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        <span className="font-headline font-bold text-lg">Home</span>
                    </Link>
                    <Link href="/search" className="flex items-center gap-4 text-slate-500 py-3 px-6 hover:bg-white/5 hover:text-[#53ddfc] transition-all duration-300 rounded-r-full group">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <span className="font-headline font-bold text-lg">Search</span>
                    </Link>
                    <Link href="/quix" className="flex items-center gap-4 text-slate-500 py-3 px-6 hover:bg-white/5 hover:text-[#53ddfc] transition-all duration-300 rounded-r-full group">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        <span className="font-headline font-bold text-lg">Quix</span>
                    </Link>
                    <Link href="/create" className="flex items-center gap-4 text-slate-500 py-3 px-6 hover:bg-white/5 hover:text-[#53ddfc] transition-all duration-300 rounded-r-full group">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                        <span className="font-headline font-bold text-lg">Create</span>
                    </Link>
                    {/* Active Tab: Report */}
                    <div className="flex items-center gap-4 text-[#ba9eff] bg-white/5 rounded-r-full border-l-4 border-[#ba9eff] py-3 px-6 translate-x-1 transition-all duration-300">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd"/></svg>
                        <span className="font-headline font-bold text-lg">Report</span>
                    </div>
                    <Link href={`/profile/${authUser?.id}`} className="flex items-center gap-4 text-slate-500 py-3 px-6 hover:bg-white/5 hover:text-[#53ddfc] transition-all duration-300 rounded-r-full group">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span className="font-headline font-bold text-lg">Profile</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content Canvas */}
            <main className="md:ml-64 min-h-screen p-6 md:p-12 relative overflow-hidden pb-32">
                {/* Background Ambient Glows */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#ba9eff]/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-[#53ddfc]/5 rounded-full blur-[100px]"></div>

                <header className="max-w-5xl mx-auto mb-12 relative z-10 pt-8 md:pt-0">
                    <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter mb-4 text-[#f8f9fe]">
                        Report <span className="text-gradient-primary">Issue</span>
                    </h2>
                    <p className="text-[#a9abb0] text-lg max-w-2xl font-light leading-relaxed">
                        Empower your community. Report urban maintenance issues directly to city officials with cryptographic verification.
                    </p>
                </header>

                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                    {/* Main Reporting Form */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="glass-card rounded-[2rem] p-8 md:p-12 ethereal-glow">
                            
                            {/* Step 1: Issue Type */}
                            <section className="mb-12">
                                <div className="flex items-center gap-3 mb-8">
                                    <span className="w-8 h-8 rounded-full bg-[#ba9eff]/20 text-[#ba9eff] flex items-center justify-center font-black text-sm">01</span>
                                    <h3 className="text-xl font-headline font-bold">What is the issue?</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {issueTypes.map(t => (
                                        <button 
                                            key={t.id}
                                            onClick={() => setType(t.id)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-3 p-6 glass-card rounded-3xl transition-all duration-300 group",
                                                type === t.id ? "bg-[#ba9eff]/10 border-[#ba9eff]/50" : "hover:border-[#ba9eff]/40 hover:bg-white/5"
                                            )}
                                        >
                                            <span className="text-3xl group-hover:scale-110 transition-transform">{t.icon}</span>
                                            <span className={cn("text-sm font-medium tracking-tight", type === t.id && "text-[#ba9eff]")}>{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Step 2: Upload Evidence */}
                            <section className="mb-12">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="w-8 h-8 rounded-full bg-[#ba9eff]/20 text-[#ba9eff] flex items-center justify-center font-black text-sm">02</span>
                                    <h3 className="text-xl font-headline font-bold">Upload Evidence</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    {previewUrls.map((url, i) => (
                                        <div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-white/10 glass-card">
                                            <img src={url} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                                <label className="border-2 border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#ba9eff]/30 hover:bg-[#ba9eff]/5 transition-all group">
                                    <div className="w-16 h-16 rounded-full bg-[#22262b] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                                        <Camera className="w-8 h-8 text-[#8455ef]" />
                                    </div>
                                    <p className="font-bold text-[#f8f9fe] mb-1">Click to browse files</p>
                                    <p className="text-[#a9abb0] text-sm">JPG, PNG, or MP4 up to 50MB</p>
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                                </label>
                            </section>

                            {/* Step 3: Location */}
                            <section className="mb-12">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="w-8 h-8 rounded-full bg-[#ba9eff]/20 text-[#ba9eff] flex items-center justify-center font-black text-sm">03</span>
                                    <h3 className="text-xl font-headline font-bold">Location</h3>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1 relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a9abb0]" />
                                        <input 
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            className="w-full bg-[#22262b] border-none rounded-2xl py-4 pl-12 pr-4 text-[#f8f9fe] placeholder:text-[#a9abb0] focus:ring-2 focus:ring-[#53ddfc]/50 transition-all font-body" 
                                            placeholder="Enter address or landmark" 
                                        />
                                    </div>
                                    <button 
                                        onClick={detectLocation}
                                        className="bg-[#22262b] hover:bg-[#282c32] text-[#53ddfc] px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <MapPin className="w-5 h-5" />
                                        Detect Location
                                    </button>
                                </div>
                            </section>

                            {/* Step 4: Issue Details */}
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="w-8 h-8 rounded-full bg-[#ba9eff]/20 text-[#ba9eff] flex items-center justify-center font-black text-sm">04</span>
                                    <h3 className="text-xl font-headline font-bold">Issue Details</h3>
                                </div>
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#22262b] border-none rounded-2xl p-6 text-[#f8f9fe] placeholder:text-[#a9abb0] focus:ring-2 focus:ring-[#ba9eff]/50 transition-all resize-none font-body" 
                                    placeholder="Describe the severity and any specific details that might help..." 
                                    rows={4}
                                ></textarea>
                            </section>
                        </div>

                        {/* Final Submission Action */}
                        <div className="flex pt-4 justify-center">
                            <button 
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full sm:w-auto px-12 py-5 rounded-full bg-gradient-to-r from-[#ba9eff] via-[#8455ef] to-[#ff86c3] text-black font-headline font-black text-xl shadow-[0_0_50px_rgba(186,158,255,0.3)] hover:shadow-[0_0_60px_rgba(186,158,255,0.5)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <>
                                        Submit Report
                                        <Send className="w-6 h-6" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Right Sidebar: Stats & Info (Asymmetric Layout) */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Live Map Card */}
                        <div className="glass-card rounded-[2rem] overflow-hidden ethereal-glow">
                            <div className="p-6 flex items-center justify-between border-b border-white/5">
                                <h4 className="font-headline font-bold text-lg">Area Map</h4>
                                <span className="text-xs font-black uppercase text-[#53ddfc] tracking-widest px-2 py-1 bg-[#53ddfc]/10 rounded-lg">Live</span>
                            </div>
                            <div className="h-64 w-full relative bg-[#111417]">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e12] via-transparent to-transparent z-10"></div>
                                {/* Marker */}
                                {location ? (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                                        <div className="w-10 h-10 bg-[#53ddfc]/20 rounded-full flex items-center justify-center animate-pulse">
                                            <div className="w-4 h-4 bg-[#53ddfc] rounded-full shadow-[0_0_15px_#53ddfc]"></div>
                                        </div>
                                        <p className="text-[10px] text-[#53ddfc] mt-2 font-mono">{location.lat.toFixed(2)}, {location.lng.toFixed(2)}</p>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center z-20">
                                        <p className="text-zinc-500 font-mono text-xs text-center px-4">Detect location to view coordinates.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity Card */}
                        <div className="glass-card rounded-[2rem] p-8 hidden md:block">
                            <h4 className="font-headline font-bold mb-6">Recent Reports</h4>
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 group cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-[#22262b] flex items-center justify-center group-hover:bg-[#ba9eff]/20 transition-colors">
                                        <svg className="w-5 h-5 text-[#ba9eff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold">Street Light Fixed</h5>
                                        <p className="text-xs text-[#a9abb0]">32 Main St • Resolved 2h ago</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 group cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-[#22262b] flex items-center justify-center group-hover:bg-[#53ddfc]/20 transition-colors">
                                        <svg className="w-5 h-5 text-[#53ddfc]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold">Pothole Repair</h5>
                                        <p className="text-xs text-[#a9abb0]">Oak Avenue • In Progress</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Navigation (Mobile Only) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-card border-t border-white/10 z-50 flex justify-around items-center h-16 px-4 pb-safe bg-[#0c0e12]/90 backdrop-blur-xl">
                <Link href="/" className="flex flex-col items-center gap-1 text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                </Link>
                <Link href="/search" className="flex flex-col items-center gap-1 text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </Link>
                <Link href="/report" className="flex flex-col items-center gap-1 text-[#ba9eff]">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd"/></svg>
                </Link>
                <Link href={`/profile/${authUser?.id}`} className="flex flex-col items-center gap-1 text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </Link>
            </nav>
        </div>
    );
}

export default function StitchReport() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0c0e12] flex justify-center py-20"><Loader2 className="animate-spin text-[#ba9eff] w-8 h-8" /></div>}>
            <StitchReportContent />
        </Suspense>
    );
}
