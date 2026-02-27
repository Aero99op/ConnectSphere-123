"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Mail, Lock, User, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect } from 'react';
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

function LoginContent() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"login" | "signup">("login");
    const router = useRouter();
    const searchParams = useSearchParams();

    const role = searchParams.get('role') || "citizen";
    const isOfficial = role === "official";

    // Check if already logged in -> Redirect
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                router.push(isOfficial ? "/?mode=department" : "/?mode=feed");
            }
        };
        checkUser();
    }, [isOfficial, router]);

    // Pre-fill credentials based on role (Jugaad for testing)
    useEffect(() => {
        if (isOfficial) {
            setEmail("spandandepartmentbbsr@gov.in");
            setPassword("1234");
        } else {
            setEmail("spandanpatra1234@gmail.com");
            setPassword("1234");
        }
    }, [isOfficial]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (mode === "login") {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password: password === "1234" ? "guest123456" : password, // Internal jugaad for test pass
                });

                if (error) {
                    if (error.message.includes("Invalid login credentials") && password === "1234") {
                        // If test bypass failed, maybe account doesn't exist, try auto-signup
                        handleAutoSignup();
                        return;
                    }
                    throw error;
                }

                toast.success("Welcome back! 🚀");
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            role: role,
                            full_name: fullName,
                        },
                    },
                });

                if (error) throw error;
                toast.success("Account created! 🌟 Check your email if verification is on, otherwise just login.");
                setMode("login");
            }

            router.push(isOfficial ? "/?mode=department" : "/?mode=feed");
        } catch (error: any) {
            toast.error(error.message || "Something went wrong!");
        } finally {
            setLoading(false);
        }
    };

    const handleAutoSignup = async () => {
        const { error: signUpError } = await supabase.auth.signUp({
            email,
            password: "guest123456",
            options: {
                data: {
                    role: isOfficial ? "official" : "citizen",
                    full_name: isOfficial ? "Department BBSR" : "Spandan Patra",
                }
            }
        });

        if (signUpError) {
            toast.error("Auto-signup failed: " + signUpError.message);
        } else {
            toast.success("Test Account Auto-created! 🚀");
            router.push(isOfficial ? "/?mode=department" : "/?mode=feed");
        }
        setLoading(false);
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
                    {mode === "login" ? "Welcome Back" : "Join ConnectSphere"}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    {mode === "login" ? "Login to your account" : "Create a new account for free"}
                </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
                <AnimatePresence mode="wait">
                    {mode === "signup" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4"
                        >
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
                        </motion.div>
                    )}
                </AnimatePresence>

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
                            {mode === "login" ? "Sign In" : "Create Account"}
                            <Sparkles className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>

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

            {/* Jugaad Notice */}
            <p className="mt-6 text-[10px] text-zinc-600 text-center uppercase tracking-widest">
                Unlimited Auth • Free Forever • ConnectSphere
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
