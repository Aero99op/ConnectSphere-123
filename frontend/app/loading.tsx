import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="flex bg-black text-white h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                <p className="text-sm font-bold text-zinc-500 tracking-widest uppercase animate-pulse">
                    Loading ConnectSphere...
                </p>
            </div>
        </div>
    );
}
