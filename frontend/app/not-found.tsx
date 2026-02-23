
import Link from "next/link";
import { MapPinOff, Home } from "lucide-react";
import { Suspense } from "react";

function NotFoundContent() {
    return (
        <div className="flex bg-black text-white h-screen flex-col items-center justify-center p-6 text-center">
            <div className="bg-yellow-500/10 p-8 rounded-[40px] mb-8 border border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                <MapPinOff className="w-24 h-24 text-yellow-500" />
            </div>
            <h2 className="text-4xl font-display font-black mb-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent tracking-tightest">
                RAASTA BHATAK GAYE?
            </h2>
            <p className="text-zinc-500 max-w-sm mb-10 text-lg leading-relaxed font-medium">
                Ye galli band hai (404). Lagta hai aap galat jagah aa gaye. Chalo wapas ghar chalte hain! 🏠
            </p>
            <Link
                href="/"
                className="flex items-center gap-3 px-10 py-4 bg-white text-black font-black uppercase tracking-widest rounded-3xl hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all shadow-premium-lg"
            >
                <Home className="w-6 h-6" />
                Wapas Ghar Chalein
            </Link>
        </div>
    );
}

export default function NotFound() {
    return (
        <Suspense fallback={<div className="flex bg-black text-white h-screen flex-col items-center justify-center p-4">Loading...</div>}>
            <NotFoundContent />
        </Suspense>
    );
}
