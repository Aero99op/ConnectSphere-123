"use client";

import { useStitchMode } from "@/components/providers/stitch-provider";
import MainUserProfile from "@/components/profile/main-profile";
import StitchProfile from "@/components/stitch/stitch-profile";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
    const { isStitchMode, isLoadingStitch } = useStitchMode();

    if (isLoadingStitch) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isStitchMode) {
        return <StitchProfile />;
    }

    return <MainUserProfile />;
}
