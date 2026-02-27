"use client";

import { useState } from "react";
import {
    Trash2,
    Repeat2,
    Calendar,
    Copy,
    MoreHorizontal,
    Check,
    AlertCircle,
    Loader2
} from "lucide-react";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface PostOptionsSheetProps {
    post: any;
    isOwner: boolean;
    onDelete?: (postId: string) => void;
    onRemention?: (post: any) => void;
}

export function PostOptionsSheet({ post, isOwner, onDelete, onRemention }: PostOptionsSheetProps) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [copying, setCopying] = useState(false);

    const handleCopyLink = () => {
        setCopying(true);
        const url = `${window.location.origin}/post/${post.id}`;
        navigator.clipboard.writeText(url);
        toast.success("Link copy ho gaya! 🔗");
        setTimeout(() => setCopying(false), 2000);
        setOpen(false);
    };

    const handleDelete = async () => {
        if (!confirm("Bhai, pakka udaana hai? Wapas nahi aayega! 🚔")) return;

        setDeleting(true);
        const { error } = await supabase.from('posts').delete().eq('id', post.id);

        if (error) {
            toast.error("Delete fail ho gaya! Permission check karlo.");
            setDeleting(false);
        } else {
            toast.success("Post koodedaal mein chali gayi! 🧨");
            onDelete?.(post.id);
            setOpen(false);
        }
    };

    const handleRemention = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        toast.loading("Rementioning (Reposting)...", { id: 'remention' });

        const { error } = await supabase.from('posts').insert({
            user_id: user.id,
            caption: `Retransmitted: ${post.caption}`,
            media_urls: post.media_urls,
            thumbnail_url: post.thumbnail_url,
            media_type: post.media_type,
            repost_of: post.id
        });

        if (error) {
            toast.error("Remention fail ho gaya!", { id: 'remention' });
            console.error(error);
        } else {
            toast.success("Remention successful! 🔄", { id: 'remention' });
            onRemention?.(post);
            setOpen(false);
        }
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <button className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </DrawerTrigger>
            <DrawerContent className="bg-zinc-900 border-t border-white/10 safebottom">
                <DrawerHeader className="border-b border-white/5">
                    <DrawerTitle className="text-center text-white font-display font-black uppercase tracking-widest text-sm">Post Operations</DrawerTitle>
                </DrawerHeader>

                <div className="p-4 space-y-3">
                    {/* Copy Link Action */}
                    <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center justify-between p-4 glass border-premium rounded-2xl hover:bg-white/5 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                                {copying ? <Check className="w-5 h-5 text-blue-500" /> : <Copy className="w-5 h-5 text-blue-500" />}
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white">Copy Post Link</p>
                                <p className="text-[10px] text-zinc-500 font-mono tracking-tight">Direct URL to clipboard</p>
                            </div>
                        </div>
                    </button>

                    {/* Remention Action */}
                    <button
                        onClick={handleRemention}
                        className="w-full flex items-center justify-between p-4 glass border-premium rounded-2xl hover:bg-white/5 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                                <Repeat2 className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white">Remention (Repost)</p>
                                <p className="text-[10px] text-zinc-500 font-mono tracking-tight">Broadcast to your feed</p>
                            </div>
                        </div>
                    </button>

                    {/* Schedule Action (Placeholder UI) */}
                    <button
                        onClick={() => toast.info("Schedule feature coming soon in V3! 🗓️")}
                        className="w-full flex items-center justify-between p-4 glass border-premium rounded-2xl hover:bg-white/5 transition-all group opacity-60"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                                <Calendar className="w-5 h-5 text-purple-500" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white">Schedule Post</p>
                                <p className="text-[10px] text-zinc-500 font-mono tracking-tight">Set tactical delay</p>
                            </div>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-400 px-2 py-1 rounded-md">Alpha</span>
                    </button>

                    {/* Delete Action (Owner Only) */}
                    {isOwner && (
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="w-full flex items-center justify-between p-4 glass border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all group mt-6"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/10 rounded-xl group-hover:bg-red-500/20 transition-colors">
                                    {deleting ? <Loader2 className="w-5 h-5 text-red-500 animate-spin" /> : <Trash2 className="w-5 h-5 text-red-500" />}
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-bold text-red-500">Self-Destruct (Delete)</p>
                                    <p className="text-[10px] text-zinc-600 font-mono tracking-tight italic">Permanent removal from matrix</p>
                                </div>
                            </div>
                            <AlertCircle className="w-4 h-4 text-red-900 opacity-20" />
                        </button>
                    )}

                    <div className="pt-4 text-center">
                        <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.3em]">Matrix Level Cryptography Enabled</p>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
