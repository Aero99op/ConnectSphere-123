"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, MapPin, Calendar, Heart, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { sanitizeInput } from "@/lib/utils";

const INTERESTS_LIST = [
    "Technology", "Sports", "Politics", "Gaming", "Music",
    "Movies", "Art", "Science", "Education", "Travel",
    "Fashion", "Food", "Fitness", "Business"
];

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { theme } = useTheme();

    // Form state
    const [country, setCountry] = useState("");
    const [age, setAge] = useState("");
    const [interests, setInterests] = useState<string[]>([]);

    const handleInterestToggle = (interest: string) => {
        if (interests.includes(interest)) {
            setInterests(interests.filter(i => i !== interest));
        } else {
            if (interests.length >= 5) {
                toast.error("You can select up to 5 interests maximum.");
                return;
            }
            setInterests([...interests, interest]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!country.trim() || !age.trim() || interests.length === 0) {
            toast.error("Please fill all the details to continue.");
            return;
        }

        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
            toast.error("Please enter a valid age (13+).");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    country: sanitizeInput(country.trim()),
                    age: ageNum,
                    interests,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save details.');
            }

            toast.success("Welcome aboard! Let's get started. 🚀");
            window.location.href = "/";
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to save details.");
            setLoading(false);
        }
    };

    return (
        <div className={cn(
            "min-h-screen flex flex-col items-center justify-center p-4 selection:bg-primary/30 relative overflow-hidden",
            theme === 'radiant-void' ? "bg-black" : "bg-[#050507]"
        )}>
             {/* Ambient Background Glow */}
             <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                {theme === 'radiant-void' ? (
                    <>
                        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]" />
                    </>
                ) : (
                    <>
                        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[100px] rounded-full" />
                    </>
                )}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                    "w-full max-w-lg z-10 transition-all duration-500",
                    theme === 'radiant-void' 
                        ? "bg-black/40 backdrop-blur-2xl border border-white/5 p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]" 
                        : "bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl"
                )}
            >
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className={cn(
                        "w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500",
                        theme === 'radiant-void' 
                            ? "bg-black border border-white/10 shadow-[0_0_30px_rgba(255,141,135,0.2)] rotate-3" 
                            : "bg-gradient-to-tr from-orange-500 to-pink-500 shadow-lg shadow-orange-500/20"
                    )}>
                        <Sparkles className={cn(
                            "w-10 h-10",
                            theme === 'radiant-void' ? "text-primary" : "text-white"
                        )} />
                    </div>
                    <h1 className={cn(
                        "text-4xl font-display font-black tracking-tightest uppercase italic",
                        theme === 'radiant-void' ? "text-white" : "bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent"
                    )}>
                        {theme === 'radiant-void' ? "INIT_AUTHENTICATION" : "Welcome to Connect"}
                    </h1>
                    <p className={cn(
                        "mt-3 text-xs font-mono uppercase tracking-[0.2em]",
                        theme === 'radiant-void' ? "text-primary/70" : "text-zinc-400"
                    )}>
                        {theme === 'radiant-void' ? "ESTABLISHING_NEURAL_LINK..." : "Personalize your experience to continue."}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Country */}
                    <div className="space-y-3">
                        <label className={cn(
                            "text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-3",
                            theme === 'radiant-void' ? "text-zinc-500" : "text-zinc-300"
                        )}>
                            <MapPin className={cn("w-3.5 h-3.5", theme === 'radiant-void' ? "text-primary/50" : "text-orange-400")} />
                            Geographic_Node
                        </label>
                        <Input
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            placeholder="OPERATIONAL_REGION (e.g. INDIA)"
                            className={cn(
                                "h-14 transition-all duration-300",
                                theme === 'radiant-void' 
                                    ? "bg-white/[0.02] border-white/5 focus:border-primary/50 text-white font-mono font-black uppercase text-xs tracking-widest" 
                                    : "bg-black/50 border-white/10 h-12"
                            )}
                            required
                        />
                    </div>

                    {/* Age */}
                    <div className="space-y-3">
                        <label className={cn(
                            "text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-3",
                            theme === 'radiant-void' ? "text-zinc-500" : "text-zinc-300"
                        )}>
                            <Calendar className={cn("w-3.5 h-3.5", theme === 'radiant-void' ? "text-accent/50" : "text-pink-400")} />
                            Temporal_Age
                        </label>
                        <Input
                            type="number"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            placeholder="CYCLE_COUNT (e.g. 21)"
                            className={cn(
                                "h-14 transition-all duration-300",
                                theme === 'radiant-void' 
                                    ? "bg-white/[0.02] border-white/5 focus:border-accent/50 text-white font-mono font-black uppercase text-xs tracking-widest" 
                                    : "bg-black/50 border-white/10 h-12"
                            )}
                            min="13"
                            max="120"
                            required
                        />
                    </div>

                    {/* Interests */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-mono font-black uppercase tracking-widest flex items-center justify-between">
                            <span className={cn("flex items-center gap-3", theme === 'radiant-void' ? "text-zinc-500" : "text-zinc-300")}>
                                <Heart className={cn("w-3.5 h-3.5", theme === 'radiant-void' ? "text-red-500/50" : "text-red-400")} />
                                Interest_Vectors
                            </span>
                            <span className="text-[10px] font-mono text-zinc-600">{interests.length}/5_LOADED</span>
                        </label>
                        <div className="flex flex-wrap gap-2.5">
                            {INTERESTS_LIST.map((interest) => {
                                const isSelected = interests.includes(interest);
                                return (
                                    <button
                                        key={interest}
                                        type="button"
                                        onClick={() => handleInterestToggle(interest)}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-[10px] font-mono font-black uppercase tracking-widest transition-all duration-300 border",
                                            isSelected
                                                ? theme === 'radiant-void' 
                                                    ? 'bg-primary border-primary text-black shadow-[0_0_15px_rgba(255,141,135,0.4)]'
                                                    : 'bg-primary border-primary text-primary-foreground shadow-md'
                                                : theme === 'radiant-void'
                                                    ? 'bg-white/[0.02] border-white/5 text-zinc-600 hover:border-white/20 hover:text-zinc-300'
                                                    : 'bg-zinc-800/50 border-white/10 text-zinc-400 hover:bg-zinc-800'
                                        )}
                                    >
                                        {interest}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={cn(
                            "w-full h-14 rounded-xl flex items-center justify-center gap-3 transition-all duration-500 font-mono font-black uppercase text-xs tracking-[0.2em] mt-10 active:scale-95",
                            theme === 'radiant-void' 
                                ? "bg-primary text-black shadow-[0_0_20px_rgba(255,141,135,0.4)] hover:shadow-[0_0_30px_rgba(255,141,135,0.6)]" 
                                : "bg-white text-black hover:bg-zinc-200"
                        )}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                {theme === 'radiant-void' ? "ACTIVATE_NEURAL_LINK" : "Let's Go"}
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
