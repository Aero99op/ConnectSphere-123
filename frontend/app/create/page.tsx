"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import MainCreate from "@/components/create/main-create";
import StitchCreate from "@/components/stitch/stitch-create";
import { Loader2 } from "lucide-react";

export default function CreatePage() {
    const { isStitchMode, isLoadingStitch } = useStitchMode();

    if (isLoadingStitch) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isStitchMode) {
        return <StitchCreate />;
    }

    return <MainCreate />;
}
