"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, User, Shield, Info, Edit3, Image as ImageIcon, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FileUpload } from "@/components/ui/file-upload";

export default function ProfileSettingsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [username, setUsername] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    // UI State
    const [showUploadModal, setShowUploadModal] = useState(false);

    useEffect(() => {
        async function loadProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('username, avatar_url, bio')
                        .eq('id', user.id)
                        .single();

                    if (data) {
                        setUsername(data.username || "");
                        setAvatarUrl(data.avatar_url || "");
                        setBio(data.bio || "");
                    }
                }
            } catch (error) {
                console.error("Error loading profile:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadProfile();
    }, []);

    const handleSave = async (specificAvatarUrl?: string) => {
        if (!userId) return;
        setIsSaving(true);
        setMessage({ text: "", type: "" });

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    username: username,
                    bio: bio,
                    ...(specificAvatarUrl ? { avatar_url: specificAvatarUrl } : {})
                })
                .eq('id', userId);

            if (error) throw error;

            setMessage({ text: "Profile updated successfully! 🔥", type: "success" });
        } catch (error: any) {
            console.error("Error saving profile:", error);
            setMessage({ text: "Something went wrong while saving.", type: "error" });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        }
    };

    const handleUploadComplete = async (urls: string[]) => {
        if (urls.length > 0) {
            const newAvatar = urls[0];
            setAvatarUrl(newAvatar);
            setShowUploadModal(false);
            // Auto-save the new avatar
            await handleSave(newAvatar);
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4 relative">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Edit Profile Info</h1>
                        <p className="text-zinc-500 text-xs mt-1">Update your name, bio, and photo here.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-6">

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center gap-4 pb-6 border-b border-white/5">
                            <div
                                className="w-24 h-24 rounded-3xl bg-black/40 border-2 border-primary/30 flex items-center justify-center relative overflow-hidden group cursor-pointer"
                                onClick={() => setShowUploadModal(true)}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-10 h-10 text-zinc-600" />
                                )}
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ImageIcon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <button
                                className="text-xs font-bold text-primary hover:text-white transition-colors uppercase tracking-widest"
                                onClick={() => setShowUploadModal(true)}
                            >
                                Change Photo
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter username"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Bio (About You)</label>
                                <div className="relative">
                                    <Edit3 className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Write something awesome..."
                                        rows={4}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            {message.text && (
                                <div className={`text-xs text-center font-bold mb-4 p-2 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                    {message.text}
                                </div>
                            )}

                            <button
                                onClick={() => handleSave()}
                                disabled={isSaving}
                                className="w-full flex justify-center items-center py-3.5 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-premium-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Upload Modal Overlay */}
                {showUploadModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-[32px] p-6 relative shadow-2xl">
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-6 text-center">
                                <h3 className="text-xl font-display font-black text-white">Upload New Photo</h3>
                                <p className="text-zinc-500 text-xs mt-1">Make sure it looks good!</p>
                            </div>

                            <FileUpload
                                onUploadComplete={handleUploadComplete}
                                maxSizeMB={10}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
