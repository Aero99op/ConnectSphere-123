"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, MessageSquare, ShieldCheck, Mail, Loader2, Globe } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

export default function MessagePreferencesPage() {
    const { user: authUser, supabase } = useAuth();
    const userId = authUser?.id || null;
    const [preference, setPreference] = useState<'all' | 'following' | 'none'>('all');

    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        async function loadMessagePrefs() {
            try {
                if (!authUser) { setIsLoading(false); return; }
                const { data } = await supabase
                    .from('profiles')
                    .select('message_preference')
                    .eq('id', authUser.id)
                    .single();

                if (data && data.message_preference) {
                    setPreference(data.message_preference as any);
                }
            } catch (error) {
                console.error("Error loading message preference:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadMessagePrefs();
    }, [authUser, supabase]);

    const handlePreferenceChange = async (newPref: 'all' | 'following' | 'none') => {
        if (!userId) return;
        setIsUpdating(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ message_preference: newPref })
                .eq('id', userId);

            if (error) throw error;
            setPreference(newPref);
            toast.success("Message settings updated!");
        } catch (error: any) {
            console.error("Error updating pref:", error);
            toast.error("Database update fail ho gaya.");
        } finally {
            setIsUpdating(false);
        }
    };

    const options = [
        { id: 'all', label: 'Everyone', desc: 'Anyone can send you a message request.', icon: Globe },
        { id: 'following', label: 'In My Circle', desc: 'Only people you follow can DM you.', icon: ShieldCheck },
        { id: 'none', label: 'No One', desc: 'Close your DMs completely.', icon: Mail },
    ];

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] opacity-30" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Message Preferences</h1>
                        <p className="text-zinc-500 text-xs mt-1">Control karein aapko kaun inbox kar sakta hai.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-6">

                        <div className="space-y-4">
                            {options.map((option) => {
                                const isActive = preference === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handlePreferenceChange(option.id as any)}
                                        disabled={isUpdating}
                                        className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left ${isActive
                                                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                                                : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={`p-3 rounded-xl ${isActive ? 'bg-primary text-black' : 'bg-zinc-900 text-zinc-500'}`}>
                                                <option.icon className="w-6 h-6" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${isActive ? 'text-primary' : 'text-zinc-100'}`}>{option.label}</span>
                                                <span className="text-[10px] text-zinc-500">{option.desc}</span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-primary bg-primary' : 'border-zinc-700'
                                            }`}>
                                            {isActive && <div className="w-2 h-2 bg-black rounded-full" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <p className="text-[10px] text-zinc-600 leading-relaxed text-center px-6">
                                ConnectSphere respects your digital peace. Changes are reflected instantly across all devices.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
