"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileEditFormProps {
    initialData: {
        id: string;
        full_name: string;
        username: string;
        bio: string;
        avatar_url: string;
    };
    onSuccess?: () => void;
}

export function ProfileEditForm({ initialData, onSuccess }: ProfileEditFormProps) {
    const [fullName, setFullName] = useState(initialData.full_name || "");
    const [bio, setBio] = useState(initialData.bio || "");
    const [avatarUrl, setAvatarUrl] = useState(initialData.avatar_url || "");
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    full_name: fullName,
                    bio: bio,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString()
                })
                .eq("id", initialData.id);

            if (error) throw error;

            toast.success("Profile Chamak Gaya! ✨ (Updated)");
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error(error);
            toast.error("Kuch gadbad ho gayi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-lg mx-auto p-4 glass-card rounded-2xl border-premium">
            <div className="flex flex-col items-center gap-4 py-4">
                <Avatar className="w-24 h-24 border-4 border-primary/20 ring-4 ring-black/50">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-zinc-800"><User className="w-12 h-12" /></AvatarFallback>
                </Avatar>

                <div className="w-full max-w-[200px]">
                    <FileUpload
                        onUploadComplete={(urls: string[]) => {
                            if (urls.length > 0) setAvatarUrl(urls[0]);
                        }}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1">Poora Naam</label>
                    <Input
                        value={fullName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                        placeholder="Tumhara naam kya hei?"
                        className="bg-black/50 border-white/10 focus:border-primary transition-all rounded-xl"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1">Username</label>
                    <Input
                        value={initialData.username}
                        disabled
                        className="bg-black/20 border-white/5 text-zinc-500 rounded-xl cursor-not-allowed"
                    />
                    <p className="text-[10px] text-zinc-600 ml-1 italic">Username change nahi ho sakta, bhai.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1">Apne Baare Mein (Bio)</label>
                    <Textarea
                        value={bio}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
                        placeholder="Kuch toh likho apne baare mein..."
                        className="bg-black/50 border-white/10 focus:border-primary transition-all rounded-xl min-h-[100px] resize-none"
                    />
                </div>
            </div>

            <Button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl shadow-lg transition-all active:scale-95"
            >
                {loading ? <Loader2 className="animate-spin mr-2" /> : "Save Kar Lo"}
            </Button>
        </div>
    );
}
