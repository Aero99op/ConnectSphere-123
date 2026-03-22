"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import MainSearch from "@/components/search/main-search";
import StitchSearch from "@/components/stitch/stitch-search";
import { Loader2 } from "lucide-react";

export default function SearchPage() {
    const { isStitchMode, isLoadingStitch } = useStitchMode();

    if (isLoadingStitch) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isStitchMode) {
        return <StitchSearch />;
    }

    return <MainSearch />;
}
