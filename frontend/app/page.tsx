"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import MainHomeFeed from "@/components/feed/main-home-feed";
import StitchHomeFeed from "@/components/stitch/stitch-home-feed";
import { Loader2 } from "lucide-react";

export default function HomeFeed() {
    const { isStitchMode, isLoadingStitch } = useStitchMode();

    if (isLoadingStitch) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isStitchMode) {
        return <StitchHomeFeed />;
    }

    return <MainHomeFeed />;
}
