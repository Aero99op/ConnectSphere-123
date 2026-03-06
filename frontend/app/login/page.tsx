"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Loader2, ArrowLeft, Mail, Lock, User, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect } from 'react';
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { signIn, useSession } from "next-auth/react";

function LoginContent() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"login" | "signup">("login");
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const role = searchParams.get('role') || "citizen";
    const isOfficial = role === "official";
    const error = searchParams.get('error');

    // Auto-Failover removed to enforce strict NextAuth session creation

    // Check if already logged in -> Redirect
    useEffect(() => {
        if (session) {
            router.push(isOfficial ? "/dashboard" : "/");
        }
    }, [session, isOfficial, router]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!otpSent) {
                // Phase 1: Send OTP via Cloudflare MailChannels (Unlimited Free)
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, action: mode }),
                });

                const data = await res.json();

                if (!res.ok) {
                    toast.error(data.error || "Failed to send OTP!");
                    setLoading(false);
                    return;
                }

                toast.success("OTP sent to your email! 🚀");
                setOtpSent(true);
            } else {
                // Phase 2: Verify OTP and Login
                const result = await signIn('credentials', {
                    email,
                    password,
                    action: mode,
                    otp,
                    fullName: mode === 'signup' ? fullName : undefined,
                    role: mode === 'signup' ? role : undefined,
                    redirect: false,
                });

                if (result?.error) {
                    toast.error(result.error);
                    setLoading(false);
                    return;
                }

                toast.success(mode === "login" ? "Welcome back! 🚀" : "Account verified & created! 🌟");
                router.push(isOfficial ? "/dashboard" : "/");
            }
        } catch (error: any) {
            toast.error(error.message || "Something went wrong!");
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            await signIn('google', {
                callbackUrl: isOfficial ? '/dashboard' : '/',
            });
        } catch (error: any) {
            toast.error("Google Auth mein lafda! 🚨");
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl z-10 relative"
        >
            <Link href="/role-selection" className="absolute top-4 left-4 text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-6 h-6" />
            </Link>

            <div className="text-center mb-8">
                <motion.div
                    layout
                    className="flex justify-center mb-2"
                >
                    <span className={`text-4xl font-black bg-clip-text text-transparent select-none tracking-tighter ${isOfficial ? 'bg-gradient-to-r from-blue-400 to-cyan-300' : 'bg-gradient-to-r from-orange-400 to-pink-500'}`}>
                        {isOfficial ? "PRO" : "CS"}
                    </span>
                </motion.div>
                <h2 className="text-2xl font-bold text-white">
                    {otpSent ? "Verify Email" : (mode === "login" ? "Welcome Back" : "Join Connect")}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    {otpSent ? `Enter the OTP sent to ${email}` : (mode === "login" ? "Login to your account" : "Create a new account for free")}
                </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
                <AnimatePresence mode="wait">
                    {!otpSent ? (
                        <motion.div
                            key="form-details"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4"
                        >
                            {mode === "signup" && (
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-600"
                                    />
                                </div>
                            )}

                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email Address"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-600"
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-600"
                                />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="otp-details"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4"
                        >
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="6-Digit OTP"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white text-center tracking-[0.5em] text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setOtpSent(false)}
                                className="text-zinc-400 hover:text-white text-sm transition-colors text-center w-full"
                            >
                                Wrong email? Go back
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full font-bold py-3 px-4 rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white ${isOfficial
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                        : 'bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700'
                        }`}
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            {!otpSent ? (mode === "login" ? "Send OTP" : "Send OTP") : "Verify & Continue"}
                            <Sparkles className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>

            {!otpSent && (
                <>
                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                        <div className="h-px bg-white/10 flex-1" />
                        <span className="text-zinc-500 text-sm font-medium">ya fir</span>
                        <div className="h-px bg-white/10 flex-1" />
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Unified Google Login Button */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            type="button"
                            className="w-full bg-white text-black font-bold py-3 px-4 rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 hover:bg-zinc-100"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-black" />
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    </svg>
                                    Google se Login Karo
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <button
                            onClick={() => setMode(mode === "login" ? "signup" : "login")}
                            className="text-zinc-400 hover:text-white text-sm transition-colors"
                        >
                            {mode === "login" ? (
                                <>New here? <span className="text-primary font-semibold">Create an account</span></>
                            ) : (
                                <>Already have an account? <span className="text-primary font-semibold">Login instead</span></>
                            )}
                        </button>
                    </div>
                </>
            )}

            {/* Free Notice */}
            <p className="mt-6 text-[10px] text-zinc-600 text-center uppercase tracking-widest">
                Unlimited Auth • Free Forever • Connect
            </p>
        </motion.div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Animations */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-700" />

            <Suspense fallback={<div className="text-white">Loading...</div>}>
                <LoginContent />
            </Suspense>
        </div>
    );
}
