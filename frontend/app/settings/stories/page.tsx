"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Plus, Loader2, Play, Trash2, Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

export default function MyStoriesPage() {
    const { user: authUser, supabase } = useAuth();
    const router = useRouter();
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchMyStories();
    }, [authUser]);

    const fetchMyStories = async () => {
        if (!authUser) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/stories?history=true`);
            const data = await res.json();
            if (data.stories) {
                setStories(data.stories);
            }
        } catch (error) {
            console.error("Failed to load stories", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const toastId = toast.loading("Uploading your story...");

        try {
            // 1. Upload to Catbox
            const formData = new FormData();
            formData.append("file", file);

            const uploadRes = await fetch("/api/upload/catbox", {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json();
                throw new Error(errorData.error || "Upload failed");
            }

            const { url } = await uploadRes.json();

            // 2. Save Story
            const isVideo = file.type.startsWith("video/");
            
            const createRes = await fetch("/api/stories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    media_url: url,
                    media_type: isVideo ? "video" : "image"
                })
            });

            if (!createRes.ok) throw new Error("Failed to save story");

            toast.success("Story posted successfully! 🚀", { id: toastId });
            fetchMyStories(); // Refresh
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to post story. Try again.", { id: toastId });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!confirm("Are you sure you want to delete this story permanently?")) return;
        
        const toastId = toast.loading("Deleting story...");
        try {
            const { error } = await supabase.from('stories').delete().eq('id', id);
            if (error) throw error;
            
            setStories(prev => prev.filter(s => s.id !== id));
            toast.success("Story deleted.", { id: toastId });
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to delete story", { id: toastId });
        }
    };

    const now = new Date();

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 md:pl-20 xl:pl-64 justify-center bg-[#050507]">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#050507] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-4xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                
                {/* Header Section */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-3xl font-display font-black text-white tracking-tight uppercase">My Stories</h1>
                        <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest font-mono">24H Temporary • Permanent Archive</p>
                    </div>
                </div>

                {/* Upload Button Box */}
                <div className="glass-card border-premium p-6 rounded-[2rem] flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-display font-black text-white">Share a moment</h3>
                        <p className="text-zinc-400 text-sm max-w-md mt-1">
                            Stories stay on your profile for 24 hours. After that, they are archived here permanently for you to look back on.
                        </p>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        disabled={uploading}
                    />
                    
                    <button
                        onClick={handleUploadClick}
                        disabled={uploading}
                        className="mt-2 bg-primary text-black font-black uppercase tracking-widest px-8 py-3 rounded-full hover:bg-primary/90 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,165,0,0.3)] flex items-center gap-2"
                    >
                        {uploading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                        ) : (
                            <><Plus className="w-4 h-4 stroke-[3]" /> Post Story</>
                        )}
                    </button>
                </div>

                {/* Stories Grid */}
                <div>
                    <h2 className="text-xl font-display font-black text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                        <Play className="w-5 h-5 text-primary" /> Story Archive
                    </h2>
                    
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : stories.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                            {stories.map(story => {
                                const isExpired = new Date(story.expires_at) < now;
                                
                                return (
                                    <div key={story.id} className="relative aspect-[9/16] group rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                                        {story.media_type === 'image' ? (
                                            <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
                                        ) : (
                                            <video src={story.media_url} className="w-full h-full object-cover" />
                                        )}
                                        
                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 p-3 flex flex-col justify-between">
                                            <div className="flex justify-between items-start">
                                                <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${isExpired ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'}`}>
                                                    {isExpired ? 'Expired' : 'Active'}
                                                </div>
                                                <button 
                                                    onClick={(e) => handleDelete(story.id, e)}
                                                    className="p-1.5 bg-black/50 hover:bg-red-500/80 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-md opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            
                                            <div className="text-[10px] text-white/70 font-mono">
                                                {new Date(story.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="glass-panel p-16 rounded-[2.5rem] text-center border-premium border-dashed opacity-60">
                            <h3 className="font-display font-black text-xl uppercase tracking-widest text-zinc-500 italic">No Stories</h3>
                            <p className="text-sm font-mono text-zinc-700 mt-2 uppercase tracking-widest">
                                Your archive is empty.
                            </p>
                        </div>
                    )}
                </div>
                
            </div>
        </div>
    );
}
