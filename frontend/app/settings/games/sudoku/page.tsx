"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Sparkles, CheckCircle2 } from "lucide-react";

export default function ZenSudoku() {
    const router = useRouter();
    const [grid, setGrid] = useState<(number | null)[][]>(() => generateSudoku());
    const [initialGrid] = useState(() => grid.map(row => [...row]));
    const [selected, setSelected] = useState<[number, number] | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    function generateSudoku() {
        const baseGrid = [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9]
        ];
        return baseGrid.map(row => row.map(cell => cell === 0 ? null : cell));
    }

    const onNumberInput = (num: number) => {
        if (!selected) return;
        const [r, c] = selected;
        if (initialGrid[r][c] !== null) return;

        const newGrid = [...grid.map(row => [...row])];
        newGrid[r][c] = num === 0 ? null : num;
        setGrid(newGrid);

        // Basic check for completion (simplified for UI demo)
        const complete = newGrid.every(row => row.every(cell => cell !== null));
        if (complete) setIsComplete(true);
    };

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#fafafa] dark:bg-[#050505] md:pl-20 lg:pl-64">
            <div className="absolute inset-0 z-0 bg-zinc-200/20 dark:bg-zinc-900/10 pointer-events-none" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-8 py-10">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-white/5 shadow-sm hover:scale-110 transition-transform">
                        <ArrowLeft className="w-5 h-5 text-zinc-500" />
                    </button>
                    <div className="text-center">
                        <h1 className="text-3xl font-display font-light tracking-tight dark:text-white text-zinc-900">Zen Sudoku</h1>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-[0.4em] font-medium mt-1">Conscious Strategy</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="p-3 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-white/5 shadow-sm hover:rotate-180 transition-transform duration-500">
                        <RotateCcw className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                <div className="grid grid-cols-9 bg-zinc-300 dark:bg-white/5 p-px rounded-2xl overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-800">
                    {grid.map((row, r) => row.map((cell, c) => {
                        const isMainGrid = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 0;
                        const isSelected = selected?.[0] === r && selected?.[1] === c;
                        const isFixed = initialGrid[r][c] !== null;

                        return (
                            <button
                                key={`${r}-${c}`}
                                onClick={() => setSelected([r, c])}
                                className={`aspect-square flex items-center justify-center text-xl font-medium transition-all
                                    ${isMainGrid ? 'bg-zinc-50 dark:bg-zinc-900/80' : 'bg-white dark:bg-zinc-950/80'}
                                    ${isSelected ? 'ring-inset ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 z-10' : ''}
                                    ${isFixed ? 'text-zinc-600 dark:text-zinc-400 font-bold' : 'text-indigo-600 dark:text-indigo-400'}
                                    border-[0.5px] border-zinc-200 dark:border-white/5
                                `}
                            >
                                {cell}
                            </button>
                        );
                    }))}
                </div>

                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                        <button
                            key={n}
                            onClick={() => onNumberInput(n)}
                            className="h-12 rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 shadow-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors active:scale-95 flex items-center justify-center"
                        >
                            {n === 0 ? 'Clear' : n}
                        </button>
                    ))}
                </div>

                <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm font-medium text-zinc-500 italic">"Focus on the empty space."</span>
                    </div>
                </div>

                {isComplete && (
                    <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-1000">
                        <CheckCircle2 className="w-24 h-24 text-indigo-500 mb-6 animate-bounce" />
                        <h2 className="text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter italic">Enlightenment Achieved</h2>
                        <button onClick={() => window.location.reload()} className="mt-8 px-12 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold rounded-full">Again</button>
                    </div>
                )}
            </div>
        </div>
    );
}
