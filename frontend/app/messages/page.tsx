// Forced re-compile to resolve stale build chunks
export const dynamic = "force-dynamic";
import { MessagesLayout } from '@/components/chat/messages-layout';
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
    title: "Guptugu (Messages) | ConnectSphere",
    description: "Your conversations on ConnectSphere",
};

function MessagesPageContent() {
    return (
        <div className="w-full h-full overflow-hidden bg-black text-white flex">
            <MessagesLayout />
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="w-full h-screen bg-black text-white flex items-center justify-center">Loading Messages...</div>}>
            <MessagesPageContent />
        </Suspense>
    );
}
