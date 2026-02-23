"use client";

import { useEffect } from "react";
import { Ghost, RotateCcw } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex bg-black text-white h-screen flex-col items-center justify-center p-6 text-center">
            <div className="bg-red-500/10 p-8 rounded-[40px] mb-8 animate-bounce transition-all duration-1000 border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                <Ghost className="w-24 h-24 text-red-500" />
            </div>
            <h2 className="text-4xl font-display font-black mb-4 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent tracking-tightest">
                ARRE YAAR! GADBAD HO GAYI.
            </h2>
            <p className="text-zinc-500 max-w-sm mb-10 text-lg leading-relaxed font-medium">
                Server shashak gaya (crashed). Don't worry, hum ise thik kar rahe hain. Tab tak mithaai khao! 🍬
            </p>
            <button
                onClick={reset}
                className="flex items-center gap-3 px-10 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-3xl hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-premium-lg"
            >
                <RotateCcw className="w-6 h-6" />
                Fir Se Try Karte Hain
            </button>
        </div>
    );
}
