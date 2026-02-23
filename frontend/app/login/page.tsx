"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect } from 'react';
import { toast } from "sonner";

function LoginContent() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState(1);
    const [tapCount, setTapCount] = useState(0);
    const router = useRouter();
    const searchParams = useSearchParams();

    const role = searchParams.get('role') || "citizen";
    const isOfficial = role === "official";

    // Pre-fill credentials based on role
    useEffect(() => {
        if (isOfficial) {
            setEmail("spandandepartmentbbsr@gov.in");
            setOtp("4321");
        } else {
            setEmail("spandanpatra1234@gmail.com");
            setOtp("1234");
        }
    }, [isOfficial]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        // JUGAD: Bypass OTP send for Test Accounts
        if (
            (email === "spandanpatra1234@gmail.com" && !isOfficial) ||
            (email === "spandandepartmentbbsr@gov.in" && isOfficial)
        ) {
            setStep(2);
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                data: { role: role },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            }
        });

        if (error) {
            setMessage("Error: " + error.message);
        } else {
            setStep(2);
            setMessage("Magic Link/OTP sent to your email!");
        }
        setLoading(false);
    };


    const verifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // JUGAD: Magic Bypass for Test Accounts
        // Creates a REAL Supabase session so auth works across all pages
        if (
            (email === "spandanpatra1234@gmail.com" && otp === "1234") ||
            (email === "spandandepartmentbbsr@gov.in" && otp === "4321")
        ) {
            const password = "guest123456";
            let { error: passError } = await supabase.auth.signInWithPassword({ email, password });

            if (passError) {
                // Account doesn't exist yet — auto-create it (jugaad for test/demo)
                console.log("Test account not found, auto-creating...", passError.message);
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            role: isOfficial ? "official" : "citizen",
                            full_name: isOfficial ? "Department BBSR" : "Spandan Patra",
                        }
                    }
                });

                if (signUpError) {
                    console.error("Auto-create failed:", signUpError.message);
                    setMessage("Error: Could not create test account - " + signUpError.message);
                    setLoading(false);
                    return;
                }

                // Now sign in with the newly created account
                const result = await supabase.auth.signInWithPassword({ email, password });
                if (result.error) {
                    // signUp may have auto-signed us in already, check session
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                        console.error("Login after signup failed:", result.error.message);
                        setMessage("Error: " + result.error.message);
                        setLoading(false);
                        return;
                    }
                }
            }

            toast.success("Welcome aboard! 🚀");
            router.push(isOfficial ? "/?mode=department" : "/?mode=feed");
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
        });

        if (error) {
            setMessage("Invalid OTP: " + error.message);
        } else {
            if (isOfficial) {
                router.push("/dashboard");
            } else {
                router.push("/");
            }
        }
        setLoading(false);
    };

    return (
        <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl z-10 relative">

            <Link href="/role-selection" className="absolute top-4 left-4 text-zinc-400 hover:text-white">
                <ArrowLeft className="w-6 h-6" />
            </Link>

            <div className="text-center mb-8">
                <div
                    className="relative z-50 focus:outline-none transition-transform active:scale-95 mx-auto block"
                >
                    <span className={`block text-3xl font-bold mb-2 bg-clip-text text-transparent select-none ${isOfficial ? 'bg-gradient-to-r from-blue-400 to-cyan-300' : 'bg-gradient-to-r from-orange-400 to-pink-500'}`}>
                        {isOfficial ? "Department Login" : "ConnectSphere"}
                    </span>
                </div>
                <p className="text-zinc-400">
                    {isOfficial ? "Authorized Personnel Only" : "Login to your account"}
                </p>
                {step === 2 && <p className="text-sm text-green-400 mt-2">Enter the OTP sent to {email}</p>}
            </div>

            {step === 1 ? (
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Email ID
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
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
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send OTP 🚀"}
                    </button>
                </form>
            ) : (
                <form onSubmit={verifyOtp} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Enter OTP
                        </label>
                        <input
                            type="text"
                            required
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="123456"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full font-bold py-3 px-4 rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white ${isOfficial
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
                            : 'bg-gradient-to-r from-orange-500 to-pink-600'
                            }`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Login ✅"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-full text-sm text-zinc-500 hover:text-white"
                    >
                        Change Email
                    </button>
                </form>
            )}

            {message && (
                <div className="mt-6 p-3 bg-white/5 border border-white/10 rounded-lg text-zinc-300 text-center text-sm animate-fade-in">
                    {message}
                </div>
            )}
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />

            <Suspense fallback={<div className="text-white">Loading...</div>}>
                <LoginContent />
            </Suspense>
        </div>
    );
}
