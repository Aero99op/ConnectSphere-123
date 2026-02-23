"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, Camera, MapPin, Upload, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { uploadToCatbox } from "@/lib/upload";
import { cn } from "@/lib/utils";

function ReportIssuePageContent() {
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
        { id: 'pothole', label: 'Pothole / Road', icon: '🛣️' },
        { id: 'garbage', label: 'Garbage Dump', icon: '🗑️' },
        { id: 'water', label: 'Water Leakage', icon: '💧' },
        { id: 'electricity', label: 'Street Light / Power', icon: '💡' },
        { id: 'traffic', label: 'Traffic / Parking', icon: '🚦' },
        { id: 'other', label: 'Other', icon: '📢' },
    ];

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);

            const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
            setPreviewUrls(prev => [...prev, ...newPreviewUrls]);

            setLoading(true);
            const uploadToast = toast.loading("Uploading photos via Proxy...");

            try {
                const uploadedUrls = await Promise.all(newFiles.map(file => uploadToCatbox(file)));
                setUploadedMediaUrls(prev => [...prev, ...uploadedUrls]);

                toast.dismiss(uploadToast);
                toast.success("Photos uploaded successfully!");
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
        toast.loading("Detecting location...");

        // 1. Try GPS (Browser Geolocation) - Works on HTTPS/Localhost
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setAddress(`GPS Location (Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)})`);
                    toast.dismiss();
                    toast.success("GPS Location Detected! 🛰️");
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

    // 2. Fallback: IP-based Location (ipapi.co)
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
                toast.success("Location Detected via Network! 🌐");
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
            const { data: { user } } = await supabase.auth.getUser();

            if (user?.email === "guest@connectsphere.com") {
                toast.error("Oops! Guests can't submit reports.", {
                    description: "Create a verified account to help your community!"
                });
                setLoading(false);
                return;
            }

            // 2. Insert into DB using REAL uploaded URLs
            const { error } = await supabase.from('reports').insert({
                user_id: user?.id || null,
                title: `${type.toUpperCase()} Issue`,
                description,
                type,
                media_urls: uploadedMediaUrls.length > 0 ? uploadedMediaUrls : previewUrls,
                latitude: location.lat,
                longitude: location.lng,
                address,
                status: 'pending'
            });

            if (error) throw error;

            toast.success("Report Submitted! Authorities notified.");
            router.push('/profile');

        } catch (e) {
            console.error(e);
            toast.error("Failed to submit report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black pb-24 text-white">
            <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-display font-black text-gradient">Civic Reports</h1>
                </div>
                <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary">
                    Civic Report
                </div>
            </div>

            <div className="p-4 max-w-lg mx-auto space-y-10 py-8">
                {/* Intro Section */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-display font-black text-white tracking-tight">Report Issue, Get Solution! 🚩</h2>
                    <p className="text-zinc-500 text-sm">Report problems in your area and bring about change.</p>
                </div>

                {/* 1. Select Type */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-2xl bg-primary text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(255,165,0,0.4)]">1</span>
                        <h3 className="text-lg font-display font-bold text-zinc-200">What is the issue?</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {issueTypes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setType(t.id)}
                                className={cn(
                                    "p-5 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 group relative overflow-hidden",
                                    type === t.id
                                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(255,165,0,0.1)]'
                                        : 'bg-zinc-900/50 border-white/5 hover:border-white/20 text-zinc-400 hover:text-zinc-200'
                                )}
                            >
                                <span className={cn("text-3xl transition-transform duration-500", type === t.id && "scale-125 rotate-6")}>{t.icon}</span>
                                <span className="text-sm font-bold tracking-tight">{t.label}</span>
                                {type === t.id && <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Photo Evidence */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-2xl bg-indigo-500 text-white flex items-center justify-center font-black shadow-[0_0_15px_rgba(99,102,241,0.4)]">2</span>
                        <h3 className="text-lg font-display font-bold text-zinc-200">Upload Evidence</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {previewUrls.map((url, i) => (
                            <div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-white/10 group shadow-xl">
                                <img src={url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                            </div>
                        ))}
                        <label className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all duration-300 group">
                            <div className="p-3 rounded-full bg-zinc-900 group-hover:scale-110 transition-transform">
                                <Camera className="w-6 h-6 text-zinc-400 group-hover:text-primary" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-500 group-hover:text-zinc-300">Upload Photo</span>
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                        </label>
                    </div>
                </div>

                {/* 3. Location */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-[0_0_15px_rgba(16,185,129,0.4)]">3</span>
                        <h3 className="text-lg font-display font-bold text-zinc-200">Location</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="relative group">
                            <input
                                placeholder="Enter address or detect automatically..."
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pl-12"
                            />
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                        </div>
                        <button
                            onClick={detectLocation}
                            className="w-full py-4 rounded-2xl bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center gap-3 transition-all active:scale-95 group"
                        >
                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-primary animate-bounce" />
                            </div>
                            Detect Location (Automatic)
                        </button>
                    </div>
                    {location && (
                        <div className="p-4 bg-zinc-900/30 rounded-2xl border border-white/5 flex items-center gap-4 animate-in slide-in-from-top-2">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Co-ordinates Captured</p>
                                <p className="text-xs text-emerald-500 font-mono">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Description */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-2xl bg-violet-500 text-white flex items-center justify-center font-black shadow-[0_0_15px_rgba(139,92,246,0.4)]">4</span>
                        <h3 className="text-lg font-display font-bold text-zinc-200">Issue Details</h3>
                    </div>
                    <textarea
                        placeholder="Tell us more about the issue..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 h-40 resize-none transition-all placeholder:text-zinc-600"
                    />
                </div>

                {/* Submit */}
                <div className="pt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={cn(
                            "w-full h-16 text-lg font-display font-black rounded-[24px] flex items-center justify-center transform transition-all duration-300 shadow-2xl overflow-hidden group relative",
                            loading
                                ? "bg-zinc-800 cursor-not-allowed opacity-50"
                                : "bg-gradient-to-r from-orange-500 via-pink-500 to-primary hover:scale-[1.02] active:scale-95 shadow-primary/25"
                        )}
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {loading ? (
                            <Loader2 className="animate-spin mr-3 w-6 h-6" />
                        ) : (
                            <AlertTriangle className="mr-3 w-6 h-6 text-black fill-black/20" />
                        )}
                        <span className="relative z-10 text-black">
                            {loading ? 'Submitting...' : 'Submit Report'}
                        </span>
                    </button>
                    <p className="text-center text-zinc-600 text-[10px] mt-4 font-bold uppercase tracking-widest">
                        ConnectSphere Transparency & Trust Protocol v1.0
                    </p>
                </div>

            </div>
        </div>
    );
}

export default function ReportIssuePage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>}>
            <ReportIssuePageContent />
        </Suspense>
    );
}
