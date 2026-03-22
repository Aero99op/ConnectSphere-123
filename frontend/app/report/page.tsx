"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import MainReport from "@/components/report/main-report";
import StitchReport from "@/components/stitch/stitch-report";
import { Loader2 } from "lucide-react";

export default function ReportPage() {
    const { isStitchMode, isLoadingStitch } = useStitchMode();

    if (isLoadingStitch) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isStitchMode) {
        return <StitchReport />;
    }

    return <MainReport />;
}
