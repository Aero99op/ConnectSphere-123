"use client";

export const dynamic = "force-dynamic";

import { FileUpload } from "@/components/ui/file-upload";
import { useAuth } from "@/components/providers/auth-provider";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { sanitizeInput } from "@/lib/utils";

import { PostEditor } from "@/components/create/post-editor";
import { triggerMentions } from "@/lib/utils/mentions";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

function MainCreatePageContent() {
    const { user: authUser, supabase } = useAuth();
    const [caption, setCaption] = useState("");
    const [fileUrls, setFileUrls] = useState<string[]>([]);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [customization, setCustomization] = useState<any>(null);
    const [showEditor, setShowEditor] = useState(false);
    const userId = authUser?.id || null;
    const router = useRouter();
    const { theme } = useTheme();

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
            <div className={cn(
                "min-h-screen flex items-center justify-center",
                theme === 'radiant-void' ? "bg-black" : "bg-[#050507]"
            )}>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className={cn(
            "min-h-screen pb-32 transition-colors duration-500",
            theme === 'radiant-void' ? "bg-black" : "bg-[#050507]"
        )}>
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                {theme === 'radiant-void' ? (
                    <>
                        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]" />
                    </>
                ) : (
                    <>
                        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[100px] rounded-full" />
                    </>
                )}
            </div>

            {/* Header */}
            <div className={cn(
                "sticky top-0 z-50 p-4 flex items-center justify-between border-b transition-all duration-500",
                theme === 'radiant-void' ? "bg-black/40 backdrop-blur-xl border-white/5" : "glass border-premium shadow-premium-sm"
            )}>
                <Link href="/" className={cn(
                    "p-2.5 rounded-xl transition-all active:scale-90",
                    theme === 'radiant-void' ? "bg-white/5 border border-white/10 hover:bg-white/10" : "glass hover:bg-white/10 text-zinc-400 hover:text-white"
                )}>
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex flex-col items-center">
                    <h1 className={cn(
                        "text-xl font-display font-black tracking-tightest",
                        theme === 'radiant-void' ? "text-white uppercase italic" : "text-white"
                    )}>
                        {isQuix ? "New_Quix" : "New_Broadcast"}
                    </h1>
                    <p className={cn(
                        "text-[10px] font-mono uppercase tracking-widest",
                        theme === 'radiant-void' ? "text-primary/70" : "text-zinc-500"
                    )}>
                        {isQuix ? "ENTER_THE_VOID" : "SYNC_TO_FEED"}
                    </p>
                </div>
                <button
                    onClick={handlePost}
                    disabled={loading || (fileUrls.length === 0 && !caption)}
                    className={cn(
                        "px-6 py-2 font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[10px]",
                        theme === 'radiant-void' 
                            ? "bg-primary text-black shadow-[0_0_20px_rgba(255,141,135,0.4)] hover:shadow-[0_0_30px_rgba(255,141,135,0.6)]" 
                            : "bg-primary text-black hover:bg-primary/90 shadow-premium-sm"
                    )}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Transmit"}
                </button>
            </div>

            <div className="relative z-10 max-w-2xl mx-auto p-4 md:p-6 md:mt-6 space-y-8">

                {/* Caption Input Container */}
                <div className={cn(
                    "relative group transition-all duration-500",
                    theme === 'radiant-void' ? "bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl" : "glass border-premium rounded-3xl p-5 shadow-premium-sm focus-within:shadow-premium-lg"
                )}>
                    {theme === 'radiant-void' ? (
                        <div className="p-1">
                             <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="TYPE_YOUR_MESSAGE_HERE..."
                                className="w-full bg-transparent border-none text-white text-lg placeholder:text-zinc-800 focus:ring-0 resize-none min-h-[140px] font-mono font-black uppercase p-4"
                            />
                        </div>
                    ) : (
                        <>
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 rounded-3xl" />
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="What's on your mind? 💭"
                                className="w-full bg-transparent border-none text-white text-lg placeholder:text-zinc-600 focus:ring-0 resize-none min-h-[120px] relative z-10 p-5"
                            />
                        </>
                    )}
                </div>

                {/* File Upload Area */}
                <div className={cn(
                    "p-6 space-y-6 transition-all duration-500 border",
                    theme === 'radiant-void' ? "bg-black rounded-xl border-white/5" : "glass-panel border-premium rounded-3xl shadow-premium-sm"
                )}>
                    <div className="flex items-center justify-between pl-2">
                        <div>
                            <h2 className={cn(
                                "text-xs font-black uppercase tracking-[0.2em]",
                                theme === 'radiant-void' ? "text-primary/80" : "text-white"
                            )}>Media_Attachments</h2>
                            <p className="text-[10px] text-zinc-600 font-mono mt-1 uppercase tracking-widest">Append visual data to your broadcast</p>
                        </div>
                    </div>

                    <div className={cn(
                        "rounded-2xl p-2 border",
                        theme === 'radiant-void' ? "bg-white/[0.02] border-white/5" : "bg-black/30 border-white/5"
                    )}>
                        {fileUrls.length === 0 ? (
                            <FileUpload onUploadComplete={handleUploadComplete} maxSizeMB={200} />
                        ) : (
                            <div className="p-12 text-center animate-in fade-in zoom-in-95">
                                <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-[0.3em]">Payload_Verified 🔒</p>
                                <p className={cn(
                                    "font-black text-xl mt-3 italic flex items-center justify-center gap-3",
                                    theme === 'radiant-void' ? "text-white uppercase" : "text-white"
                                )}>
                                    <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_15px_rgba(255,141,135,0.8)]" />
                                    Media_Encrypted
                                </p>
                                <Button
                                    onClick={() => setShowEditor(true)}
                                    className={cn(
                                        "mt-6 text-[10px] font-black uppercase tracking-[0.2em] px-8 py-2",
                                        theme === 'radiant-void' ? "bg-white/5 border border-white/10 hover:bg-white/10 text-primary" : "bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300"
                                    )}
                                >
                                    Modify_Visual_Cores
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
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
                        toast.success("Layers_Applied! 🔮");
                    }}
                />
            )}
        </div>
    );
}

export default function MainCreate() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>}>
            <MainCreatePageContent />
        </Suspense>
    );
}
