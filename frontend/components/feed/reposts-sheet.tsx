"use client";

import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useTranslation } from "@/components/providers/language-provider";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { StoryAvatar } from "@/components/ui/story-avatar";
import { Loader2, User } from "lucide-react";
import Link from "next/link";

interface RepostsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entityId: string;
    entityType: 'post' | 'quix';
}

export function RepostsSheet({ open, onOpenChange, entityId, entityType }: RepostsSheetProps) {
    const { supabase } = useAuth();
    const { t } = useTranslation();
    const { theme } = useTheme();
    const [reposters, setReposters] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && entityId) {
            fetchReposters();
        }
    }, [open, entityId, entityType]);

    const fetchReposters = async () => {
        setLoading(true);
        try {
            if (entityType === 'post') {
                const { data, error } = await supabase
                    .from('posts')
                    .select('profiles!user_id(id, username, full_name, avatar_url, role)')
                    .eq('repost_of', entityId);
                
                if (error) throw error;
                const users = data?.map(d => d.profiles).filter(Boolean) || [];
                // De-duplicate in case of multiple reposts by same user (unlikely but safe)
                const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.id, u])).values());
                setReposters(uniqueUsers);
            } else {
                const { data, error } = await supabase
                    .from('quix_reposts')
                    .select('profiles!user_id(id, username, full_name, avatar_url, role)')
                    .eq('quix_id', entityId);

                if (error) throw error;
                const users = data?.map(d => d.profiles).filter(Boolean) || [];
                setReposters(users);
            }
        } catch (error) {
            console.error("Failed to fetch reposters:", error);
        } finally {
            setLoading(false);
        }
    };

    const UserList = () => (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : reposters.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                    {reposters.map((user) => (
                        <Link
                            key={user.id}
                            href={`/profile/${user.id}`}
                            onClick={() => onOpenChange(false)}
                            className="group relative block"
                        >
                            <div className={cn(
                                "flex items-center gap-4 p-3 transition-all",
                                theme === 'radiant-void' ? "bg-white/5 border border-white/5 rounded-xl hover:bg-white/10" : "glass rounded-2xl border-premium hover:bg-white/5"
                            )} >
                                <StoryAvatar
                                    user={user}
                                    className="w-10 h-10 object-cover border border-white/10"
                                />
                                <div className="min-w-0">
                                    <p className={cn(
                                        "font-bold text-sm tracking-tight truncate",
                                        theme === 'radiant-void' ? "text-white uppercase italic" : "text-white"
                                    )}>
                                        {user.full_name || user.username}
                                    </p>
                                    <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                                        @{user.username}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="py-20 text-center opacity-40">
                    <User className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
                    <p className="text-xs font-mono uppercase tracking-widest">No reposts yet</p>
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Mobile Drawer */}
            <div className="sm:hidden">
                <Drawer open={open} onOpenChange={onOpenChange}>
                    <DrawerContent className="bg-zinc-950 border-t border-white/10 pb-10">
                        <DrawerHeader className="border-b border-white/5">
                            <DrawerTitle className="text-center text-white font-display font-black uppercase tracking-widest text-sm italic">
                                {t('post.reposts_title')}
                            </DrawerTitle>
                        </DrawerHeader>
                        <UserList />
                    </DrawerContent>
                </Drawer>
            </div>

            {/* Desktop Dialog */}
            <div className="hidden sm:block">
                <Dialog open={open} onOpenChange={onOpenChange}>
                    <DialogContent className="bg-zinc-950 border border-white/10 p-0 overflow-hidden sm:max-w-md">
                        <DialogHeader className="p-4 border-b border-white/5">
                            <DialogTitle className="text-white font-display font-black uppercase tracking-widest text-sm italic">
                                {t('post.reposts_title')}
                            </DialogTitle>
                        </DialogHeader>
                        <UserList />
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
