"use client";

export const dynamic = "force-dynamic";

import { FileUpload } from "@/components/ui/file-upload";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function CreatePostPageContent() {
    const [caption, setCaption] = useState("");
    const [fileUrls, setFileUrls] = useState<string[]>([]);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Check Auth
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUserId(data.user.id);
            } else {
                router.push("/login");
            }
        });
    }, [router]);

    const handleUploadComplete = (urls: string[], thumb?: string) => {
        setFileUrls(urls); // Store the full array of chunk URLs
        if (thumb) setThumbnailUrl(thumb);
    };

    const handlePost = async () => {
        if (!userId) return;
        if (fileUrls.length === 0 && caption.trim() === "") {
            alert("Please add some text or upload a file!");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email === "guest@connectsphere.com") {
            toast.error("Oops! Guests can't post to the feed.", {
                description: "Create a real account to share your thoughts!"
            });
            return;
        }

        setLoading(true);

        const mediaType = thumbnailUrl ? 'video' : (fileUrls.length > 0 ? 'image' : 'text');

        const { error } = await supabase.from("posts").insert({
            user_id: userId,
            caption: caption,
            file_urls: fileUrls, // Save array to Supabase Text[] type column
            thumbnail_url: thumbnailUrl,
            media_type: mediaType,
            likes_count: 0
        });

        if (error) {
            console.error(error);
            alert("Post failed! Please try again.");
            setLoading(false);
        } else {
            router.push("/"); // Go to Feed
        }
    };

    if (!userId) {
        return (
            <div className="min-h-screen bg-[#050507] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050507] pb-32 selection:bg-primary/30">
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <div className="sticky top-0 z-50 glass border-b border-premium p-4 flex items-center justify-between shadow-premium-sm">
                <Link href="/" className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex flex-col items-center">
                    <h1 className="text-xl font-display font-black text-white tracking-tightest">New Post</h1>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Share to Feed</p>
                </div>
                <button
                    onClick={handlePost}
                    disabled={loading || (fileUrls.length === 0 && !caption)}
                    className="px-5 py-2 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-premium-sm"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Post"}
                </button>
            </div>

            <div className="relative z-10 max-w-2xl mx-auto p-4 md:p-6 md:mt-6 space-y-6">

                {/* Caption Input Container */}
                <div className="glass border-premium rounded-3xl p-5 shadow-premium-sm focus-within:shadow-premium-lg transition-all duration-300 group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 rounded-3xl" />
                    <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="What's on your mind? 💭"
                        className="w-full bg-transparent border-none text-white text-lg placeholder:text-zinc-600 focus:ring-0 resize-none min-h-[120px] relative z-10"
                    />
                </div>

                {/* File Upload Area */}
                <div className="glass-panel border-premium rounded-3xl p-6 shadow-premium-sm space-y-4">
                    <div className="flex items-center justify-between pl-2">
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Media Attachments</h2>
                            <p className="text-xs text-zinc-500 font-mono mt-1">Add photos or videos to boost engagement</p>
                        </div>
                    </div>

                    <div className="bg-black/30 rounded-2xl p-2 border border-white/5">
                        <FileUpload onUploadComplete={handleUploadComplete} maxSizeMB={200} />
                    </div>
                </div>

                {/* Placeholder Filter UI (Visual Only for now) */}
                {fileUrls.length > 0 && (
                    <div className="glass border-premium rounded-2xl p-4 shadow-premium-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Filters (Coming Soon)</h3>
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                            {['Normal', 'Clarendon', 'Gingham', 'Moon', 'Lark'].map((filter) => (
                                <div key={filter} className="flex flex-col items-center gap-2 shrink-0 cursor-not-allowed opacity-50">
                                    <div className="w-16 h-16 rounded-xl bg-zinc-800 border-2 border-transparent hover:border-primary/50 transition-colors" />
                                    <span className="text-[10px] font-mono text-zinc-500">{filter}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CreatePostPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>}>
            <CreatePostPageContent />
        </Suspense>
    );
}
