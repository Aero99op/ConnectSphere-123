"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import MainQuix from "@/components/quix/main-quix";
import StitchQuix from "@/components/stitch/stitch-quix";
import { Loader2 } from "lucide-react";

export default function QuixPage() {
    const { isStitchMode, isLoadingStitch } = useStitchMode();

    if (isLoadingStitch) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isStitchMode) {
        return <StitchQuix />;
    }

    return <MainQuix />;
}
