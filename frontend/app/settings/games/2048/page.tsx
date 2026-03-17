"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Trophy, Sparkles } from "lucide-react";

type Grid = number[][];

export default function Game2048() {
    const router = useRouter();
    const [grid, setGrid] = useState<Grid>([]);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isWon, setIsWon] = useState(false);
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

    // Initialize Game
    const initGame = useCallback(() => {
        let newGrid = Array(4).fill(null).map(() => Array(4).fill(0));
        newGrid = addRandomTile(newGrid);
        newGrid = addRandomTile(newGrid);
        setGrid(newGrid);
        setScore(0);
        setGameOver(false);
        setIsWon(false);
    }, []);

    useEffect(() => {
        const savedBest = localStorage.getItem("2048-best-score");
        if (savedBest) setBestScore(parseInt(savedBest));
        initGame();
    }, [initGame]);

    useEffect(() => {
        if (score > bestScore) {
            setBestScore(score);
            localStorage.setItem("2048-best-score", score.toString());
        }
    }, [score, bestScore]);

    const addRandomTile = (currentGrid: Grid): Grid => {
        const emptyCells = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (currentGrid[r][c] === 0) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length === 0) return currentGrid;
        const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const newGrid = currentGrid.map(row => [...row]);
        newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
        return newGrid;
    };

    const move = (direction: 'up' | 'down' | 'left' | 'right') => {
        if (gameOver) return;

        let newGrid = grid.map(row => [...row]);
        let moved = false;
        let newScore = score;

        const rotateGrid = (g: Grid) => {
            return g[0].map((_, i) => g.map(row => row[i]).reverse());
        };

        // Normalize direction to 'left' by rotating
        let rotations = 0;
        if (direction === 'up') rotations = 1;
        else if (direction === 'right') rotations = 2;
        else if (direction === 'down') rotations = 3;

        for (let i = 0; i < rotations; i++) newGrid = rotateGrid(newGrid);

        // Slide and Merge
        for (let r = 0; r < 4; r++) {
            let row = newGrid[r].filter(val => val !== 0);
            for (let c = 0; c < row.length - 1; c++) {
                if (row[c] === row[c + 1]) {
                    row[c] *= 2;
                    newScore += row[c];
                    if (row[c] === 2048) setIsWon(true);
                    row.splice(c + 1, 1);
                    moved = true;
                }
            }
            const filledRow = [...row, ...Array(4 - row.length).fill(0)];
            if (JSON.stringify(newGrid[r]) !== JSON.stringify(filledRow)) moved = true;
            newGrid[r] = filledRow;
        }

        // Rotate back
        for (let i = 0; i < (4 - rotations) % 4; i++) newGrid = rotateGrid(newGrid);

        if (moved) {
            const gridWithRandom = addRandomTile(newGrid);
            setGrid(gridWithRandom);
            setScore(newScore);
            checkGameOver(gridWithRandom);
        }
    };

    const checkGameOver = (g: Grid) => {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (g[r][c] === 0) return;
            }
        }
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (c < 3 && g[r][c] === g[r][c + 1]) return;
                if (r < 3 && g[r][c] === g[r + 1][c]) return;
            }
        }
        setGameOver(true);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') move('up');
            else if (e.key === 'ArrowDown') move('down');
            else if (e.key === 'ArrowLeft') move('left');
            else if (e.key === 'ArrowRight') move('right');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [grid, score, gameOver]);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart) return;
        const dx = e.changedTouches[0].clientX - touchStart.x;
        const dy = e.changedTouches[0].clientY - touchStart.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (Math.max(absX, absY) > 30) {
            if (absX > absY) {
                if (dx > 0) move('right');
                else move('left');
            } else {
                if (dy > 0) move('down');
                else move('up');
            }
        }
        setTouchStart(null);
    };

    const getTileColor = (val: number) => {
        switch (val) {
            case 2: return "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-white";
            case 4: return "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-white";
            case 8: return "bg-orange-200 text-orange-900 dark:bg-orange-500/20 dark:text-orange-400";
            case 16: return "bg-orange-300 text-orange-900 dark:bg-orange-500/40 dark:text-orange-400";
            case 32: return "bg-orange-400 text-white";
            case 64: return "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]";
            case 128: return "bg-yellow-200 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-400";
            case 256: return "bg-yellow-300 text-yellow-900 shadow-[0_0_20px_rgba(253,224,71,0.4)]";
            case 512: return "bg-yellow-400 text-yellow-900 shadow-[0_0_25px_rgba(250,204,21,0.5)]";
            case 1024: return "bg-yellow-500 text-white shadow-[0_0_30px_rgba(234,179,8,0.6)]";
            case 2048: return "bg-indigo-600 text-white shadow-[0_0_40px_rgba(79,70,229,0.7)] animate-pulse";
            default: return "bg-zinc-300/30 dark:bg-zinc-900/40";
        }
    };

    return (
        <div 
            className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#fafafa] dark:bg-[#050505] md:pl-20 lg:pl-64 py-10"
            style={{ touchAction: 'none' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="absolute inset-0 z-0 bg-zinc-200/20 dark:bg-zinc-900/10 pointer-events-none" />
            
            <div className="z-10 w-full max-w-md px-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm hover:scale-110 transition-transform"><ArrowLeft className="w-5 h-5 text-zinc-500" /></button>
                    <div className="text-center">
                        <h1 className="text-4xl font-display font-light tracking-tight dark:text-white text-zinc-900">2048</h1>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-[0.4em] font-medium mt-1">Numerical Singularity</p>
                    </div>
                    <button onClick={initGame} className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm hover:rotate-180 transition-transform duration-500"><RotateCcw className="w-5 h-5 text-zinc-500" /></button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col items-center">
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-1">Score</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-white">{score}</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col items-center">
                        <p className="text-[10px] text-amber-500/80 uppercase font-bold tracking-widest mb-1">Peak</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-white">{bestScore}</p>
                    </div>
                </div>

                <div className="aspect-square w-full bg-zinc-200 dark:bg-zinc-800/50 p-3 rounded-[2rem] gap-3 grid grid-cols-4 relative shadow-2xl border-4 border-white dark:border-zinc-800">
                    {grid.flat().map((val, i) => (
                        <div 
                            key={i} 
                            className={`w-full h-full rounded-2xl flex items-center justify-center text-xl md:text-2xl font-black transition-all duration-200 shadow-sm
                                ${getTileColor(val)}
                                ${val ? 'scale-100' : 'scale-95 opacity-50'}
                            `}
                        >
                            {val || ""}
                        </div>
                    ))}

                    {(gameOver || isWon) && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-xl rounded-[2rem] animate-in fade-in zoom-in duration-500 text-center px-6">
                            <Trophy className={`w-16 h-16 mb-4 animate-bounce ${isWon ? 'text-yellow-500' : 'text-zinc-500'}`} />
                            <h2 className="text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter italic">
                                {isWon ? "Ascended" : "Phase Over"}
                            </h2>
                            <button onClick={initGame} className="mt-8 px-12 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold rounded-full hover:scale-105 transition-transform">Reset Matrix</button>
                        </div>
                    )}
                </div>

                <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <p className="text-xs font-medium text-zinc-500 italic">"Merge the numbers to reach <span className="text-indigo-500 font-bold">2048</span>."</p>
                    </div>
                </div>
                
                <p className="text-center text-[10px] text-zinc-400 uppercase tracking-widest font-bold mt-4">Swipe or use Arrow Keys to collapse the grid.</p>
            </div>
        </div>
    );
}
