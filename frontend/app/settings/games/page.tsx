"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Gamepad2, Trophy, Zap, Puzzle, Hash } from "lucide-react";
import { useTranslation } from "@/components/providers/language-provider";

export default function GamesLandingPage() {
    const router = useRouter();
    const { t } = useTranslation();

    const games = [
        {
            id: "2048",
            name: "2048",
            description: "Merge the tiles and get to 2048!",
            icon: Hash,
            color: "bg-orange-500",
            href: "/settings/games/2048",
            highFidelity: true
        },
        {
            id: "memory",
            name: "Memory Match",
            description: "Test your memory skills!",
            icon: Puzzle,
            color: "bg-blue-500",
            href: "/settings/games/memory",
            highFidelity: true
        },
        {
            id: "tetris",
            name: "Tetris",
            description: "Classic brick breaking action.",
            icon: Zap,
            color: "bg-purple-500",
            href: "/settings/games/tetris",
            highFidelity: true
        },
        {
            id: "snake",
            name: "Snake Retro",
            description: "Classic snake with a modern twist.",
            icon: Trophy,
            color: "bg-green-500",
            href: "/settings/games/snake",
            highFidelity: true
        }
    ];

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 md:pl-20 lg:pl-64 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] opacity-40" />
                <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] opacity-30" />
            </div>

            <div className="w-full max-w-2xl py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-display font-black text-white tracking-tight">
                            {t('settings.games')}
                        </h1>
                        <p className="text-zinc-500 text-sm mt-1">{t('settings.games_desc')}</p>
                    </div>
                </div>

                {/* Games Grid */}
                <div className="grid grid-cols-1 gap-4">
                    {games.map((game) => (
                        <button
                            key={game.id}
                            onClick={() => router.push(game.href)}
                            className="group relative flex items-center gap-6 p-6 rounded-3xl glass border-premium hover:border-white/20 transition-all text-left overflow-hidden"
                        >
                            {/* Accent Background */}
                            <div className={`absolute inset-0 ${game.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                            
                            <div className={`w-16 h-16 rounded-2xl ${game.color}/20 border border-${game.color}/30 flex items-center justify-center shrink-0`}>
                                <game.icon className={`w-8 h-8 ${game.color.replace('bg-', 'text-')}`} />
                            </div>

                            <div className="flex flex-col gap-1 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-zinc-100">{game.name}</span>
                                    {game.highFidelity && (
                                        <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase text-primary tracking-widest">
                                            High Fidelity
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-zinc-500 leading-relaxed">{game.description}</p>
                            </div>

                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                <ArrowLeft className="w-5 h-5 rotate-180 text-zinc-500 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
