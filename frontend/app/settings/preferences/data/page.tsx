"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Database, Wifi, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DataUsageSettingsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [dataSaver, setDataSaver] = useState(false);
    const [highUploadQuality, setHighUploadQuality] = useState(true);
    const [autoplayVideos, setAutoplayVideos] = useState<'wifi' | 'always' | 'never'>('wifi');

    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        async function loadDataSettings() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('data_saver, high_upload_quality, autoplay_videos')
                        .eq('id', user.id)
                        .single();

                    if (data) {
                        setDataSaver(data.data_saver ?? false);
                        setHighUploadQuality(data.high_upload_quality ?? true);
                        if (data.autoplay_videos) setAutoplayVideos(data.autoplay_videos);
                    }
                }
            } catch (error) {
                console.error("Error loading data settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadDataSettings();
    }, []);

    const toggleSetting = async (field: 'data_saver' | 'high_upload_quality', currentValue: boolean) => {
        if (!userId) return;

        setIsUpdating(field);
        setMessage({ text: "", type: "" });

        const newValue = !currentValue;

        if (field === 'data_saver') setDataSaver(newValue);
        if (field === 'high_upload_quality') setHighUploadQuality(newValue);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ [field]: newValue })
                .eq('id', userId);

            if (error) throw error;
        } catch (error: any) {
            console.error(`Error updating ${field}:`, error);
            if (field === 'data_saver') setDataSaver(currentValue);
            if (field === 'high_upload_quality') setHighUploadQuality(currentValue);
            setMessage({ text: "Gadbad! Database update nahi hua.", type: "error" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } finally {
            setIsUpdating(null);
        }
    };

    const handleAutoplayChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!userId) return;

        const newValue = e.target.value as 'wifi' | 'always' | 'never';
        setIsUpdating('autoplay_videos');
        setMessage({ text: "", type: "" });

        const previousValue = autoplayVideos;
        setAutoplayVideos(newValue);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ autoplay_videos: newValue })
                .eq('id', userId);

            if (error) throw error;
        } catch (error: any) {
            console.error("Error updating autoplay:", error);
            setAutoplayVideos(previousValue);
            setMessage({ text: "Gadbad! Database update nahi hua.", type: "error" });
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } finally {
            setIsUpdating(null);
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Data Usage</h1>
                        <p className="text-zinc-500 text-xs mt-1">Mobile Data wagera bachao.</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="glass p-6 rounded-[32px] border-premium shadow-premium-lg space-y-6">

                        {message.text && (
                            <div className={`text-xs text-center font-bold mb-2 p-2 rounded-lg ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : ''}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Data Saver Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <Database className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">Data Saver</span>
                                        <span className="text-[10px] text-zinc-500">Low resolution images and stop auto-play.</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={dataSaver}
                                        onChange={() => toggleSetting('data_saver', dataSaver)}
                                        disabled={isUpdating === 'data_saver'}
                                    />
                                    <div className={`w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${dataSaver ? 'bg-primary' : ''}`}></div>
                                </label>
                            </div>

                            {/* High-Upload Quality Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <ImageIcon className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">High-Upload Quality</span>
                                        <span className="text-[10px] text-zinc-500">Apni posts ko best quality mein upload karein.</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={highUploadQuality}
                                        onChange={() => toggleSetting('high_upload_quality', highUploadQuality)}
                                        disabled={isUpdating === 'high_upload_quality'}
                                    />
                                    <div className={`w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${highUploadQuality ? 'bg-primary' : ''}`}></div>
                                </label>
                            </div>

                            {/* Auto-play videos Dropdown */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <Wifi className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">Auto-play videos</span>
                                        <span className="text-[10px] text-zinc-500">Wifi only pe auto-play hoga.</span>
                                    </div>
                                </div>
                                <select
                                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-primary/50 transition-colors uppercase tracking-widest cursor-pointer disabled:opacity-50"
                                    value={autoplayVideos}
                                    onChange={handleAutoplayChange}
                                    disabled={isUpdating === 'autoplay_videos'}
                                >
                                    <option value="wifi">Wi-Fi Only</option>
                                    <option value="always">Always</option>
                                    <option value="never">Never</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
