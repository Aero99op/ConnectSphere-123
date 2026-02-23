"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Bell, BellRing, Smartphone, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function NotificationsSettingsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [emailAlerts, setEmailAlerts] = useState(false);
    const [inAppAlerts, setInAppAlerts] = useState(true);

    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        async function loadNotificationSettings() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('push_notifications, email_alerts, in_app_alerts')
                        .eq('id', user.id)
                        .single();

                    if (data) {
                        setPushNotifications(data.push_notifications ?? true);
                        setEmailAlerts(data.email_alerts ?? false);
                        setInAppAlerts(data.in_app_alerts ?? true);
                    }
                }
            } catch (error) {
                console.error("Error loading notification settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadNotificationSettings();
    }, []);

    const toggleSetting = async (field: 'push_notifications' | 'email_alerts' | 'in_app_alerts', currentValue: boolean) => {
        if (!userId) return;

        setIsUpdating(field);
        setMessage({ text: "", type: "" });

        const newValue = !currentValue;

        // Optimistic UI update
        if (field === 'push_notifications') setPushNotifications(newValue);
        if (field === 'email_alerts') setEmailAlerts(newValue);
        if (field === 'in_app_alerts') setInAppAlerts(newValue);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ [field]: newValue })
                .eq('id', userId);

            if (error) throw error;

        } catch (error: any) {
            console.error(`Error updating ${field}:`, error);
            // Revert on error
            if (field === 'push_notifications') setPushNotifications(currentValue);
            if (field === 'email_alerts') setEmailAlerts(currentValue);
            if (field === 'in_app_alerts') setInAppAlerts(currentValue);
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
                        <h1 className="text-2xl font-display font-black text-white tracking-tight">Notifications</h1>
                        <p className="text-zinc-500 text-xs mt-1">Apne alerts aur notifications manage karo.</p>
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
                            {/* Push Notifications Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <BellRing className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">Push Notifications</span>
                                        <span className="text-[10px] text-zinc-500">Jab app band ho tab bhi notification aayegi.</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={pushNotifications}
                                        onChange={() => toggleSetting('push_notifications', pushNotifications)}
                                        disabled={isUpdating === 'push_notifications'}
                                    />
                                    <div className={`w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${pushNotifications ? 'bg-primary' : ''}`}></div>
                                </label>
                            </div>

                            {/* Email Alerts Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <Mail className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">Email Alerts</span>
                                        <span className="text-[10px] text-zinc-500">Naye followers aur messages ki email.</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={emailAlerts}
                                        onChange={() => toggleSetting('email_alerts', emailAlerts)}
                                        disabled={isUpdating === 'email_alerts'}
                                    />
                                    <div className={`w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${emailAlerts ? 'bg-primary' : ''}`}></div>
                                </label>
                            </div>

                            {/* In-App Alerts Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <Smartphone className="w-6 h-6 text-zinc-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-100">In-App Alerts</span>
                                        <span className="text-[10px] text-zinc-500">Jab app main ho toh likes/comments ki popups.</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={inAppAlerts}
                                        onChange={() => toggleSetting('in_app_alerts', inAppAlerts)}
                                        disabled={isUpdating === 'in_app_alerts'}
                                    />
                                    <div className={`w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${inAppAlerts ? 'bg-primary' : ''}`}></div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
