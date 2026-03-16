"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Gem } from "lucide-react";

export default function CrystalMahjong() {
    const router = useRouter();
    const [tiles, setTiles] = useState<{ id: number; symbol: string; matched: boolean; selected: boolean }[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const SYMBOLS = ["💎", "💠", "🌟", "✨", "🔥", "💧", "🌿", "⚡", "🌈", "☀️"];

    const initTiles = () => {
        let newTiles = [];
        for (let i = 0; i < SYMBOLS.length; i++) {
            newTiles.push({ id: i * 2, symbol: SYMBOLS[i], matched: false, selected: false });
            newTiles.push({ id: i * 2 + 1, symbol: SYMBOLS[i], matched: false, selected: false });
        }
        setTiles(newTiles.sort(() => Math.random() - 0.5));
        setSelectedIds([]);
    };

    useEffect(() => { initTiles(); }, []);

    const handleTileClick = (id: number) => {
        const clickedTile = tiles.find(t => t.id === id);
        if (!clickedTile || clickedTile.matched || selectedIds.length >= 2 || selectedIds.includes(id)) return;

        const nextSelected = [...selectedIds, id];
        setSelectedIds(nextSelected);

        if (nextSelected.length === 2) {
            const [id1, id2] = nextSelected;
            const tile1 = tiles.find(t => t.id === id1)!;
            const tile2 = tiles.find(t => t.id === id2)!;

            if (tile1.symbol === tile2.symbol) {
                setTimeout(() => {
                    setTiles(prev => prev.map(t => (t.id === id1 || t.id === id2) ? { ...t, matched: true } : t));
                    setSelectedIds([]);
                }, 500);
            } else {
                setTimeout(() => setSelectedIds([]), 800);
            }
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#0a0a0b] md:pl-20 lg:pl-64">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#161e31_0%,transparent_80%)] opacity-40" />
            
            <div className="z-10 w-full max-w-2xl px-4 flex flex-col gap-8 py-10">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium"><ArrowLeft /></button>
                    <div className="text-center">
                        <h1 className="text-4xl font-black italic tracking-tighter bg-gradient-to-br from-cyan-400 via-blue-400 to-indigo-500 bg-clip-text text-transparent">Crystal Mahjong</h1>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] mt-1">Ethereal Symmetry</p>
                    </div>
                    <button onClick={initTiles} className="p-3 glass rounded-2xl border-premium hover:rotate-180 transition-transform"><RotateCcw /></button>
                </div>

                <div className="grid grid-cols-4 md:grid-cols-5 gap-3 p-4 glass rounded-[40px] border-premium bg-zinc-900/40 shadow-2xl">
                    {tiles.map(tile => (
                        <button
                            key={tile.id}
                            onClick={() => handleTileClick(tile.id)}
                            className={`aspect-[3/4] rounded-2xl transition-all duration-500 relative perspective-500 
                                ${tile.matched ? 'opacity-0 scale-50 pointer-events-none' : 'hover:scale-105'}
                            `}
                        >
                            <div className={`w-full h-full transition-all duration-500 preserve-3d ${selectedIds.includes(tile.id) ? 'rotate-y-180' : ''}`}>
                                {/* Front */}
                                <div className="absolute inset-0 glass rounded-2xl border-premium bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center backface-hidden shadow-lg overflow-hidden">
                                     <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shine_3s_infinite]" />
                                     <Gem className="w-8 h-8 text-zinc-600/50" />
                                </div>
                                {/* Back */}
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-600/40 rounded-2xl border border-cyan-400/30 flex items-center justify-center rotate-y-180 backface-hidden shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                                    <span className="text-4xl drop-shadow-md">{tile.symbol}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-6 rounded-3xl glass border-premium bg-cyan-500/5 flex justify-center">
                    <p className="text-xs text-zinc-400 font-medium tracking-wide italic">"Match the ethereal vibrations to dissolve the crystals."</p>
                </div>
            </div>

            <style jsx>{`
                @keyframes shine {
                    0% { background-position: 200% 200%; }
                    100% { background-position: -200% -200%; }
                }
                .rotate-y-180 { transform: rotateY(180deg); }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .perspective-500 { perspective: 1000px; }
            `}</style>
        </div>
    );
}
