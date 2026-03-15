"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";

type Grid = number[][];

export default function Game2048() {
    const router = useRouter();
    const [grid, setGrid] = useState<Grid>([]);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isWon, setIsWon] = useState(false);

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
        // Check for empty cells
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (g[r][c] === 0) return;
            }
        }
        // Check for possible merges
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

    const getTileColor = (val: number) => {
        switch (val) {
            case 2: return "bg-zinc-200 text-zinc-800";
            case 4: return "bg-zinc-300 text-zinc-800";
            case 8: return "bg-orange-200 text-orange-900";
            case 16: return "bg-orange-300 text-orange-900";
            case 32: return "bg-orange-400 text-white";
            case 64: return "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]";
            case 128: return "bg-yellow-200 text-yellow-900";
            case 256: return "bg-yellow-300 text-yellow-900 shadow-[0_0_20px_rgba(253,224,71,0.4)]";
            case 512: return "bg-yellow-400 text-yellow-900 shadow-[0_0_25px_rgba(250,204,21,0.5)]";
            case 1024: return "bg-yellow-500 text-white shadow-[0_0_30px_rgba(234,179,8,0.6)]";
            case 2048: return "bg-primary text-white shadow-[0_0_40px_rgba(239,68,68,0.7)] animate-pulse";
            default: return "bg-white/5";
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 md:pl-20 lg:pl-64 justify-center overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[100px] opacity-40" />
                <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-zinc-500/10 rounded-full blur-[100px] opacity-30" />
            </div>

            <div className="w-full max-w-md py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-4xl font-display font-black tracking-tighter italic bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">2048</h1>
                    </div>
                    <button
                        onClick={initGame}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                    >
                        <RotateCcw className="w-6 h-6 group-active:rotate-180 transition-transform duration-500" />
                    </button>
                </div>

                {/* Score Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl glass border-premium flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Score</span>
                        <span className="text-2xl font-bold">{score}</span>
                    </div>
                    <div className="p-4 rounded-3xl glass border-premium flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5 text-yellow-500" /> Best
                        </span>
                        <span className="text-2xl font-bold">{bestScore}</span>
                    </div>
                </div>

                {/* Game Board */}
                <div className="relative aspect-square w-full p-2 bg-zinc-900/50 backdrop-blur-xl rounded-[2.5rem] border border-white/5 shadow-2xl">
                    <div className="grid grid-cols-4 grid-rows-4 gap-2 h-full">
                        {grid.map((row, r) => (
                            row.map((cell, c) => (
                                <div
                                    key={`${r}-${c}`}
                                    className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 font-bold text-2xl md:text-3xl ${getTileColor(cell)} overflow-hidden`}
                                >
                                    {cell !== 0 && (
                                        <div className="animate-in fade-in zoom-in duration-300">
                                            {cell}
                                        </div>
                                    )}
                                    {/* Glass reflection */}
                                    <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 skew-y-[-10deg] translate-y-[-50%]" />
                                </div>
                            ))
                        ))}
                    </div>

                    {/* Game Over Overlays */}
                    {(gameOver || isWon) && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-[2.5rem] animate-in fade-in duration-500">
                            <h2 className="text-4xl font-black mb-4">
                                {isWon ? "You Won! 🎉" : "Game Over! 💀"}
                            </h2>
                            <button
                                onClick={initGame}
                                className="px-8 py-3 rounded-2xl bg-primary text-white font-bold hover:scale-105 transition-transform active:scale-95"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-zinc-500 text-center text-sm">
                    Use <span className="text-white font-bold">Arrow Keys</span> to move tiles. <br/>
                    Merge identical numbers to reach <span className="text-orange-400 font-bold italic">2048</span>!
                </p>
            </div>
        </div>
    );
}
