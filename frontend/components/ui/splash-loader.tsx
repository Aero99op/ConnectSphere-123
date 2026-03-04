"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function SplashLoader() {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShow(false), 2000); // Minimum 2s splash
        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-out fade-out duration-500 fill-mode-forwards" style={{ animationDelay: "1.8s" }}>
            <div className="relative w-32 h-32 animate-pulse">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500 to-cyan-500 blur-xl opacity-50 animate-spin-slow"></div>
                <img src="/logo.svg" alt="Connect" className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(255,165,0,0.5)]" />
            </div>
            <div className="absolute bottom-12 text-zinc-400 font-display font-medium tracking-[0.3em] uppercase text-[10px] animate-pulse">
                Connect
            </div>
            <p className="text-xs text-zinc-500 mt-2 font-mono">India Ka Apna Social Media</p>
        </div>
    );
}
