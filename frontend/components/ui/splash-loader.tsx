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
                <img src="/logo.svg" alt="ConnectSphere" className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(255,165,0,0.5)]" />
            </div>
            <h1 className="mt-8 text-2xl font-bold bg-gradient-to-r from-orange-400 via-white to-cyan-400 bg-clip-text text-transparent tracking-[0.2em] uppercase animate-pulse">
                ConnectSphere
            </h1>
            <p className="text-xs text-zinc-500 mt-2 font-mono">India Ka Apna Social Media</p>
        </div>
    );
}
