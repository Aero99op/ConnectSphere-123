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

export default function OnboardingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

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
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl"
            >
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                        Welcome to Connect
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm">
                        Just a few details to personalize your feed before we jump in!
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Country */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-orange-400" />
                            Country
                        </label>
                        <Input
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            placeholder="e.g. India"
                            className="bg-black/50 border-white/10 h-12"
                            required
                        />
                    </div>

                    {/* Age */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-pink-400" />
                            Age
                        </label>
                        <Input
                            type="number"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            placeholder="e.g. 21"
                            className="bg-black/50 border-white/10 h-12"
                            min="13"
                            max="120"
                            required
                        />
                    </div>

                    {/* Interests */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Heart className="w-4 h-4 text-red-400" />
                                Interests
                            </span>
                            <span className="text-xs text-zinc-500">{interests.length}/5 selected</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {INTERESTS_LIST.map((interest) => {
                                const isSelected = interests.includes(interest);
                                return (
                                    <button
                                        key={interest}
                                        type="button"
                                        onClick={() => handleInterestToggle(interest)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${isSelected
                                            ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
                                            : 'bg-zinc-800/50 border-white/10 text-zinc-400 hover:border-white/30 hover:bg-zinc-800'
                                            }`}
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
                        className="w-full bg-white text-black font-semibold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Let's Go
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
