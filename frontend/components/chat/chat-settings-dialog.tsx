"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, CheckCheck, Ghost, Lock } from "lucide-react";
import { toast } from "sonner";

interface ChatSettingsDialogProps {
    onClose: () => void;
}

export function ChatSettingsDialog({ onClose }: ChatSettingsDialogProps) {
    const { user, supabase } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // States
    const [sendReadReceipts, setSendReadReceipts] = useState(true);
    const [ghostMode, setGhostMode] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        
        fetch(`/api/chat/settings?userId=${user.id}`)
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setSendReadReceipts(data.send_read_receipts !== false); // default true
                    
                    const isGhost = data.hide_online_status || (data.ghost_mode_until && new Date(data.ghost_mode_until) > new Date());
                    setGhostMode(!!isGhost);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [user]);

    const handleToggleReadReceipts = async (checked: boolean) => {
        if (!user?.id) return;
        setSendReadReceipts(checked);
        setSaving(true);
        
        const res = await fetch('/api/chat/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, settings: { send_read_receipts: checked } })
        });
        const data = await res.json();
            
        if (!res.ok || data.error) {
            toast.error("Settings save fail ho gayi");
            setSendReadReceipts(!checked);
        } else {
            toast.success(checked ? "Read Receipts On" : "Read Receipts Off (Blue ticks hidden)");
        }
        setSaving(false);
    };

    const handleToggleGhostMode = async (checked: boolean) => {
        if (!user?.id) return;
        setGhostMode(checked);
        setSaving(true);
        
        const updates: any = { hide_online_status: checked };
        if (checked) {
            const until = new Date();
            until.setHours(until.getHours() + 24);
            updates.ghost_mode_until = until.toISOString();
            // Go offline immediately
            updates.is_online = false;
        } else {
            updates.ghost_mode_until = null;
            updates.is_online = true; // come back online
        }
        
        const res = await fetch('/api/chat/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, settings: updates })
        });
        const data = await res.json();
            
        if (!res.ok || data.error) {
            toast.error("Ghost mode update fail");
            setGhostMode(!checked);
        } else {
            toast.success(checked ? "Ghost Mode Active 👻" : "Ghost Mode Off");
            
            // Broadcast via Apinator
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: 'public-presence',
                    event: 'user-status',
                    data: { id: user.id, online: !checked }
                })
            }).catch(console.error);
        }
        setSaving(false);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-zinc-900 text-white border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                        <ShieldCheck className="w-5 h-5 text-green-500" />
                        Chat Settings
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 py-4">
                        
                        {/* Read Receipts */}
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-blue-500/10 rounded-full mt-1 shrink-0">
                                <CheckCheck className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="flex-1 shrink-0 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="read-receipts" className="text-base font-medium leading-none cursor-pointer">
                                        Read Receipts
                                    </Label>
                                    <Switch 
                                        id="read-receipts" 
                                        checked={sendReadReceipts} 
                                        onCheckedChange={handleToggleReadReceipts}
                                        disabled={saving}
                                        className="data-[state=checked]:bg-green-500"
                                    />
                                </div>
                                <p className="text-xs text-zinc-400 mt-2 leading-snug">
                                    If turned off, you won't send or receive Read Receipts (Blue Ticks).
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-zinc-800 w-full" />

                        {/* Ghost Mode */}
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-orange-500/10 rounded-full mt-1 shrink-0">
                                <Ghost className="w-5 h-5 text-orange-400" />
                            </div>
                            <div className="flex-1 shrink-0 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="ghost-mode" className="text-base font-medium leading-none cursor-pointer">
                                        Ghost Mode (Freeze Last Seen)
                                    </Label>
                                    <Switch 
                                        id="ghost-mode" 
                                        checked={ghostMode} 
                                        onCheckedChange={handleToggleGhostMode}
                                        disabled={saving}
                                        className="data-[state=checked]:bg-green-500"
                                    />
                                </div>
                                <p className="text-xs text-zinc-400 mt-2 leading-snug">
                                    Hide your online status and freeze your Last Seen for 24 hours. Nobody will know you're here.
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-zinc-800 w-full" />

                        {/* E2EE Info */}
                        <div className="flex items-start gap-4 opacity-80">
                            <div className="p-2 bg-green-500/10 rounded-full mt-1 shrink-0">
                                <Lock className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex-1 pr-8 shrink-0 min-w-0">
                                <Label className="text-base font-medium leading-none">
                                    End-to-End Encrypted
                                </Label>
                                <p className="text-xs text-zinc-400 mt-2 leading-snug">
                                    Your personal messages and calls are secured with Quantum-Resistant encryption. Not even ConnectSphere can read or listen to them.
                                </p>
                            </div>
                        </div>

                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
