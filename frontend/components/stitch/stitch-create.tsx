"use client";

import { FileUpload } from "@/components/ui/file-upload";
import { useAuth } from "@/components/providers/auth-provider";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, UploadCloud, Rocket } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { sanitizeInput } from "@/lib/utils";

import { PostEditor } from "@/components/create/post-editor";
import { triggerMentions } from "@/lib/utils/mentions";
import { cn } from "@/lib/utils";

function StitchCreateContent() {
    const { user: authUser, supabase } = useAuth();
    const [caption, setCaption] = useState("");
    const [fileUrls, setFileUrls] = useState<string[]>([]);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [customization, setCustomization] = useState<any>(null);
    const [showEditor, setShowEditor] = useState(false);
    const userId = authUser?.id || null;
    const router = useRouter();

    useEffect(() => {
        if (!authUser) {
            router.push("/login");
        }
    }, [authUser, router]);

    const handleUploadComplete = (urls: string[], thumb?: string) => {
        setFileUrls(urls);
        if (thumb) setThumbnailUrl(thumb);
        setShowEditor(true);
    };

    const searchParams = useSearchParams();
    const type = searchParams.get("type");
    const isQuix = type === "quix";

    const handlePost = async () => {
        if (!userId) return;
        if (fileUrls.length === 0 && caption.trim() === "") {
            toast.error("Please add text or media!");
            return;
        }

        if (authUser?.email === "guest@connectsphere.com") {
            toast.error("Oops! Guests can't post.", {
                description: "Create a real account to share your thoughts!"
            });
            return;
        }

        setLoading(true);

        const mediaType = thumbnailUrl ? 'video' : (fileUrls.length > 0 ? 'image' : 'text');
        const sanitizedCaption = sanitizeInput(caption);

        if (isQuix) {
            if (!thumbnailUrl) {
                toast.error("Quix must be a video!");
                setLoading(false);
                return;
            }

            const { error } = await supabase.from("quix").insert({
                user_id: userId,
                caption: sanitizedCaption,
                video_url: fileUrls[0],
                thumbnail_url: thumbnailUrl,
                customization: customization || {},
            });

            if (error) {
                console.error(error);
                toast.error("Failed to upload Quix!");
                setLoading(false);
            } else {
                const { data: newQuix } = await supabase.from('quix').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
                if (newQuix) {
                    triggerMentions(supabase, sanitizedCaption, userId, newQuix.id, 'quix');
                }
                router.push("/quix");
            }
            return;
        }

        const { error } = await supabase.from("posts").insert({
            user_id: userId,
            caption: sanitizedCaption,
            media_urls: fileUrls,
            thumbnail_url: thumbnailUrl,
            media_type: mediaType,
            likes_count: 0,
            customization: customization || {},
        });

        if (error) {
            console.error(error);
            toast.error("Post failed! Please try again.");
            setLoading(false);
        } else {
            const { data: newPost } = await supabase.from('posts').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
            if (newPost) {
                triggerMentions(supabase, sanitizedCaption, userId, newPost.id, 'post');
            }
            router.push("/");
        }
    };

    if (!userId) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-[#0c0e12]">
                <Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" />
            </div>
        );
    }

    return (
        <div className="bg-[#0c0e12] text-[#f8f9fe] font-body selection:bg-[#ba9eff]/30 min-h-screen pb-20 overflow-x-hidden">
            <style dangerouslySetInnerHTML={{ __html: `
                .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); }
                .glass-border-dashed { background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='24' ry='24' stroke='%23ba9eff66' stroke-width='2' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e"); border-radius: 24px; }
                .font-headline { font-family: 'Plus Jakarta Sans', sans-serif; }
            `}} />

            {/* Background Decorative Elements */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-[#ba9eff]/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-[#53ddfc]/5 blur-[150px] rounded-full"></div>
            </div>

            {/* Side Navigation Shell */}
            <aside className="fixed left-0 top-0 h-full w-64 flex flex-col py-8 bg-[#0c0e12] border-r border-white/5 z-40 hidden md:flex">
                <div className="px-8 mb-12 mt-4 cursor-pointer" onClick={() => router.push('/')}>
                    <h1 className="text-xl font-black text-[#ba9eff] font-headline tracking-tighter">Connect</h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mt-1">Creator Studio</p>
                </div>
                <nav className="flex-1 flex flex-col gap-1 px-4">
                    <Link href="/" className="flex items-center gap-4 px-4 py-3 text-white/40 hover:bg-white/5 hover:text-white transition-all duration-200 group rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        <span className="font-headline text-sm font-medium">Home</span>
                    </Link>
                    <Link href="/search" className="flex items-center gap-4 px-4 py-3 text-white/40 hover:bg-white/5 hover:text-white transition-all duration-200 group rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <span className="font-headline text-sm font-medium">Search</span>
                    </Link>
                    <Link href="/quix" className="flex items-center gap-4 px-4 py-3 text-white/40 hover:bg-white/5 hover:text-white transition-all duration-200 group rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        <span className="font-headline text-sm font-medium">Quix</span>
                    </Link>
                    <div className="flex items-center gap-4 px-4 py-3 text-[#53ddfc] border-r-2 border-[#53ddfc] bg-gradient-to-r from-[#53ddfc]/10 to-transparent transition-all duration-200 group">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
                        <span className="font-headline text-sm font-medium font-bold">Create</span>
                    </div>
                    <Link href="/report" className="flex items-center gap-4 px-4 py-3 text-white/40 hover:bg-white/5 hover:text-white transition-all duration-200 group rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <span className="font-headline text-sm font-medium">Report</span>
                    </Link>
                    <Link href={`/profile/${authUser?.id}`} className="flex items-center gap-4 px-4 py-3 text-white/40 hover:bg-white/5 hover:text-white transition-all duration-200 group rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span className="font-headline text-sm font-medium">Profile</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="md:pl-64 pt-8 md:pt-16 pb-12 px-6 min-h-screen flex flex-col items-center relative z-10">
                <div className="w-full max-w-4xl">
                    
                    {/* Header Section */}
                    <div className="mb-10 text-center">
                        <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tighter mb-4 text-[#f8f9fe]">
                            {isQuix ? "New Quix" : "New Publication"}
                        </h1>
                        <p className="text-[#a9abb0] text-lg max-w-xl mx-auto">
                            Share your latest masterpiece with the world. Quality is the only metric that matters.
                        </p>
                    </div>

                    {/* Upload Area */}
                    <div className="relative group mb-8">
                        {fileUrls.length === 0 ? (
                            <div className="relative w-full glass-border-dashed p-1">
                                <div className="relative w-full flex flex-col items-center justify-center rounded-[24px] bg-white/5 backdrop-blur-xl border border-white/5 overflow-hidden py-10">
                                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#ba9eff]/20 blur-[100px] rounded-full"></div>
                                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#53ddfc]/20 blur-[100px] rounded-full"></div>
                                    <div className="z-10 text-center flex flex-col items-center w-full px-4">
                                        <div className="w-16 h-16 rounded-full bg-[#22262b] flex items-center justify-center mb-6 shadow-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500">
                                            <UploadCloud className="w-8 h-8 text-[#ba9eff]" />
                                        </div>
                                        <div className="w-full relative z-50 flex items-center justify-center -mt-6">
                                            <FileUpload onUploadComplete={handleUploadComplete} maxSizeMB={200} />
                                        </div>
                                        <p className="text-white/20 text-xs mt-4 font-mono uppercase tracking-widest pointer-events-none">Supports MP4, MOV, PNG up to 200MB</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-panel rounded-3xl overflow-hidden relative group aspect-[4/5] md:aspect-video mb-8 border border-white/10 shadow-[0_0_40px_rgba(139,92,246,0.15)] flex items-center justify-center bg-black">
                                {thumbnailUrl ? (
                                    <video src={fileUrls[0]} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                                ) : (
                                    <img src={fileUrls[0]} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 rounded-full bg-secondary/20 text-[#53ddfc] text-xs font-bold tracking-widest uppercase border border-[#53ddfc]/30">Quality Preserved</span>
                                        <button 
                                            onClick={() => setShowEditor(true)}
                                            className="px-3 py-1 rounded-full bg-[#ba9eff]/20 text-[#ba9eff] text-xs font-bold tracking-widest uppercase border border-[#ba9eff]/30 hover:bg-[#ba9eff]/30 transition-colors"
                                        >
                                            Edit Visuals
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Form Section */}
                    <div className="grid grid-cols-1 gap-8">
                        <div className="space-y-4">
                            <label className="block text-xs font-bold uppercase tracking-widest text-[#ba9eff]/80 ml-1">Caption & Context</label>
                            <div className="relative group">
                                <textarea 
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    className="w-full h-[160px] bg-black border border-[#ba9eff]/30 focus:border-[#ba9eff] rounded-2xl p-6 text-white placeholder:text-white/20 outline-none transition-all duration-300 resize-none font-body shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus:shadow-[0_0_20px_rgba(186,158,255,0.2)]" 
                                    placeholder="Write something captivating..." 
                                />
                                <div className="absolute bottom-4 right-6 text-white/20 text-xs font-mono">{caption.length} / 2200</div>
                            </div>
                        </div>

                        {/* CTA Section */}
                        <div className="pt-6">
                            <button 
                                onClick={handlePost}
                                disabled={loading || (fileUrls.length === 0 && !caption)}
                                className="w-full py-5 rounded-2xl bg-gradient-to-br from-[#ba9eff] to-[#8455ef] text-black font-black text-xl tracking-tight shadow-[0_20px_60px_-15px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(186,158,255,0.6)] border border-white/10 relative overflow-hidden group transition-all duration-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                        <>
                                            {isQuix ? "Upload Quix" : "Upload Content"}
                                            <Rocket className="w-5 h-5" />
                                        </>
                                    )}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out"></div>
                            </button>
                            <p className="text-center text-xs text-white/20 mt-4 font-medium tracking-widest uppercase">Content will be processed securely before going live</p>
                        </div>
                    </div>

                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 w-full h-16 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4 z-50">
                <Link href="/" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></Link>
                <Link href="/search" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></Link>
                <Link href="/create" className="w-10 h-10 bg-gradient-to-tr from-[#ba9eff] to-[#53ddfc] rounded-full flex items-center justify-center text-black shadow-lg shadow-[#ba9eff]/30 scale-110"><svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></Link>
                <Link href="/quix" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></Link>
                <Link href="/report" className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg></Link>
                <Link href={`/profile/${authUser?.id}`} className="text-slate-400 scale-95 active:scale-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></Link>
            </div>

            {/* Post Editor Overlay */}
            {showEditor && fileUrls.length > 0 && (
                <PostEditor
                    mediaUrl={fileUrls[0]}
                    mediaType={thumbnailUrl ? "video" : "image"}
                    onCancel={() => setShowEditor(false)}
                    onComplete={(data) => {
                        setCustomization(data);
                        setShowEditor(false);
                        toast.success("Layers Applied! 🔮");
                    }}
                />
            )}
        </div>
    );
}

export default function StitchCreate() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0c0e12] flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#ba9eff]" /></div>}>
            <StitchCreateContent />
        </Suspense>
    );
}
