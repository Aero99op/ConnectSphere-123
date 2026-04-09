"use client";

import { useState, useEffect, useRef } from "react";
import { QuixCard } from "./quix-card";
import { Loader2 } from "lucide-react";

interface QuixViewerProps {
    quixList: any[];
    loading?: boolean;
    initialId?: string;
}

export function QuixViewer({ quixList, loading, initialId }: QuixViewerProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialId && quixList.length > 0 && containerRef.current) {
            const index = quixList.findIndex(q => q.id === initialId);
            if (index !== -1) {
                setActiveIndex(index);
                containerRef.current.scrollTo({
                    top: index * containerRef.current.clientHeight,
                    behavior: 'instant'
                });
            }
        }
    }, [initialId, quixList]);

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
                    <QuixCard
                        quix={quix}
                        isActive={index === activeIndex}
                        shouldPreload={Math.abs(index - activeIndex) <= 1}
                    />
                </div>
            ))}
        </div>
    );
}
