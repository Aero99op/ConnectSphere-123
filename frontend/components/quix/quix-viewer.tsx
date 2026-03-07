"use client";

import { useState, useEffect, useRef } from "react";
import { QuixCard } from "./quix-card";
import { Loader2 } from "lucide-react";

interface QuixViewerProps {
    quixList: any[];
    loading?: boolean;
}

export function QuixViewer({ quixList, loading }: QuixViewerProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (index !== activeIndex) {
            setActiveIndex(index);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            </div>
        );
    }

    if (quixList.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-white p-10 text-center">
                <p className="text-zinc-500 font-display font-bold">No Quix available yet. Be the first to upload! 🎥</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
            onScroll={handleScroll}
        >
            {quixList.map((quix, index) => (
                <div key={quix.id} className="w-full h-full snap-start">
                    <QuixCard quix={quix} isActive={index === activeIndex} />
                </div>
            ))}
        </div>
    );
}
