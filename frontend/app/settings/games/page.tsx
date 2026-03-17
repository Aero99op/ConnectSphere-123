"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Zap, Puzzle, Hash, Rocket, Activity, Target, ShieldAlert, Cpu, Gem, Grid, MousePointer2, Type, Brain, Globe, Ghost, Shield, Layers } from "lucide-react";
import { useTranslation } from "@/components/providers/language-provider";
import React from "react";

export default function GamesLandingPage() {
    const router = useRouter();
    const { t } = useTranslation();

    const games = [
        { id: "neon-stack", name: "Neon Stack", desc: "Addictive 3D block stacking protocol.", icon: Layers, color: "bg-purple-500", href: "/settings/games/neon-stack", genre: "3D Arcade" },
        { id: "marble-master", name: "Marble Master", desc: "3D physics balance challenge.", icon: Gem, color: "bg-emerald-500", href: "/settings/games/marble-master", genre: "3D Physics" },
        { id: "cyber-runner", name: "Cyber Runner", desc: "High-speed 3D tunnel navigation.", icon: Rocket, color: "bg-cyan-500", href: "/settings/games/cyber-runner", genre: "3D Runner" },
        { id: "neon-pong", name: "Neon Pong", desc: "Classic arcade with a glow twist.", icon: Activity, color: "bg-rose-500", href: "/settings/games/neon-pong", genre: "Classic" },
        { id: "sudoku", name: "Zen Sudoku", desc: "Minimalist luxury strategy.", icon: Brain, color: "bg-indigo-400", href: "/settings/games/sudoku", genre: "Strategy" },
        { id: "minesweeper", name: "Cyber Mines", desc: "Tactical data reconstruction.", icon: ShieldAlert, color: "bg-emerald-500", href: "/settings/games/minesweeper", genre: "Puzzle" },
        { id: "mahjong", name: "Crystal Mahjong", desc: "Ethereal tile matching.", icon: Gem, color: "bg-blue-400", href: "/settings/games/mahjong", genre: "Board" },
        { id: "tic-tac-toe", name: "Neon Tic-Tac-Toe", desc: "Matrix grid system parity.", icon: Grid, color: "bg-cyan-400", href: "/settings/games/tic-tac-toe", genre: "Strategy" },
        { id: "word-guess", name: "Word Guess", desc: "Linguistic matrix decryption.", icon: Type, color: "bg-teal-500", href: "/settings/games/word-guess", genre: "Word" },
        { id: "2048", name: "2048", desc: "Merge the logical numbers.", icon: Hash, color: "bg-orange-500", href: "/settings/games/2048", genre: "Logic" },
        { id: "memory", name: "Memory Match", desc: "Neural pattern recognition.", icon: Puzzle, color: "bg-blue-500", href: "/settings/games/memory", genre: "Logic" },
        { id: "tetris", name: "Tetris", desc: "Standard brick stacking protocol.", icon: Zap, color: "bg-purple-500", href: "/settings/games/tetris", genre: "Classic" },
        { id: "snake", name: "Snake Retro", desc: "Legacy serpentine movement.", icon: Trophy, color: "bg-green-500", href: "/settings/games/snake", genre: "Classic" }
    ];

    return (
        <div className="flex w-full min-h-screen text-white relative pb-32 md:pl-20 lg:pl-64 justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-4xl py-6 md:py-10 flex flex-col gap-10 z-10 px-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <button onClick={() => router.back()} className="mt-1 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-110">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-display font-black text-white tracking-tighter italic uppercase">
                                Neon Arcade
                            </h1>
                            <p className="text-zinc-500 text-sm mt-1 font-medium tracking-wide">Select your digital challenge protocol.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 px-6 py-4 rounded-3xl glass border-premium bg-white/5">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Protocol</span>
                            <span className="text-xl font-black text-primary italic">ACTIVE</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Nodes</span>
                            <span className="text-xl font-black text-white italic">{games.length}</span>
                        </div>
                    </div>
                </div>

                {/* Games Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {games.map((game) => (
                        <button
                            key={game.id}
                            onClick={() => router.push(game.href)}
                            className="group relative flex items-center gap-5 p-5 rounded-[2rem] glass border-premium hover:border-white/20 transition-all text-left overflow-hidden hover:scale-[1.02] active:scale-95"
                        >
                            {/* Accent Background */}
                            <div className={`absolute inset-0 ${game.color} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
                            
                            <div className={`w-16 h-16 rounded-2xl ${game.color}/10 border border-${game.color}/20 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] group-hover:shadow-[0_0_20px_${game.color}40] transition-shadow`}>
                                <game.icon className={`w-8 h-8 ${game.color.replace('bg-', 'text-')}`} />
                            </div>

                            <div className="flex flex-col gap-1 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-black text-zinc-100 italic tracking-tight">{game.name}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] font-black uppercase text-zinc-400 tracking-widest">
                                        {game.genre}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-500 leading-relaxed font-medium">{game.desc}</p>
                            </div>

                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors border border-transparent group-hover:border-white/5">
                                <ArrowLeft className="w-4 h-4 rotate-180 text-zinc-500 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
