"use client";

import { useState } from "react";
import {
    Trash2,
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/language-provider";

interface QuixOptionsSheetProps {
    quix: any;
    isOwner: boolean;
    onDelete?: (quixId: string) => void;
    trigger?: React.ReactNode;
}

export function QuixOptionsSheet({ quix, isOwner, onDelete, trigger }: QuixOptionsSheetProps) {
    const { supabase, user: authUser } = useAuth();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [copying, setCopying] = useState(false);

    const handleCopyLink = async () => {
        setCopying(true);
        const url = `${window.location.origin}/quix?id=${quix.id}`;
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/quix?initialId=${quix.id}`);
            toast.success(t('quix.link_copied'));
        } catch (err) {
            toast.error("Copy failed.");
        } finally {
            setTimeout(() => setCopying(false), 2000);
            setOpen(false);
        }
    };

    const handleDelete = async () => {
        if (!authUser || authUser.id !== quix.user_id) {
            toast.error("Unauthorized delete attempt blocked.");
            return;
        }
        setDeleting(true);

        try {
            const { error } = await supabase
                .from('quixes')
                .delete()
                .eq('id', quix.id);

            if (error) {
                throw error;
            }

            toast.success(t('quix.delete_success'));
            onDelete?.(quix.id);
            setDeleteConfirmOpen(false);
            setOpen(false);
        } catch (error: any) {
            console.error("Delete Error:", error);
            toast.error(`${t('common.error')}: ${error.message}`);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {trigger || (
                    <button className="p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white transition-all active:scale-75">
                        <MoreHorizontal className="w-7 h-7" />
                    </button>
                )}
            </DrawerTrigger>
            <DrawerContent className="bg-zinc-900 border-t border-white/10 safebottom">
                <DrawerHeader className="text-left border-b border-white/5">
                    <DrawerTitle className="text-white font-display font-black uppercase tracking-widest text-sm">{t('quix.options')}</DrawerTitle>
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
                                <p className="text-sm font-bold text-white">{t('quix.copy_link')}</p>
                                <p className="text-[10px] text-zinc-500 font-mono tracking-tight">{t('quix.copy_link_desc')}</p>
                            </div>
                        </div>
                    </button>

                    {/* Delete Action (Owner Only) */}
                    {isOwner && (
                        <button
                            onClick={() => {
                                setOpen(false);
                                setDeleteConfirmOpen(true);
                            }}
                            disabled={deleting}
                            className="w-full flex items-center justify-between p-4 glass border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all group mt-6"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/10 rounded-xl group-hover:bg-red-500/20 transition-colors">
                                    {deleting ? <Loader2 className="w-5 h-5 text-red-500 animate-spin" /> : <Trash2 className="w-5 h-5 text-red-500" />}
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-bold text-red-500">{t('quix.delete_permanently')}</p>
                                    <p className="text-[10px] text-zinc-600 font-mono tracking-tight italic">{t('quix.delete_permanently_desc')}</p>
                                </div>
                            </div>
                            <AlertCircle className="w-4 h-4 text-red-900 opacity-20" />
                        </button>
                    )}

                    <div className="pt-4 text-center">
                        <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.3em]">{t('quix.e2e_removal')}</p>
                    </div>
                </div>
            </DrawerContent>

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="bg-zinc-950 border border-red-500/30 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-400 font-display font-black">{t('quix.delete_confirm_title')}</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {t('quix.delete_confirm_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setDeleteConfirmOpen(false)}
                            disabled={deleting}
                            className="px-4 py-2 rounded-xl border border-white/15 text-zinc-200 hover:bg-white/5 transition-all disabled:opacity-50 font-bold text-xs uppercase"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs transition-all disabled:opacity-50 inline-flex items-center gap-2"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Confirm Delete
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </Drawer>
    );
}
