"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Bomb, Flag, Terminal } from "lucide-react";

export default function CyberpunkMinesweeper() {
    const router = useRouter();
    const ROWS = 10;
    const COLS = 10;
    const MINES = 15;

    const [grid, setGrid] = useState<{ isMine: boolean; revealed: boolean; flagged: boolean; neighborCount: number }[][]>([]);
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);

    const initGrid = () => {
        let newGrid = Array(ROWS).fill(null).map(() => 
            Array(COLS).fill(null).map(() => ({ isMine: false, revealed: false, flagged: false, neighborCount: 0 }))
        );

        // Place mines
        let minesPlaced = 0;
        while (minesPlaced < MINES) {
            const r = Math.floor(Math.random() * ROWS);
            const c = Math.floor(Math.random() * COLS);
            if (!newGrid[r][c].isMine) {
                newGrid[r][c].isMine = true;
                minesPlaced++;
            }
        }

        // Calculate neighbors
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (newGrid[r][c].isMine) continue;
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (r+dr >= 0 && r+dr < ROWS && c+dc >= 0 && c+dc < COLS && newGrid[r+dr][c+dc].isMine) count++;
                    }
                }
                newGrid[r][c].neighborCount = count;
            }
        }
        setGrid(newGrid);
        setGameOver(false);
        setWon(false);
    };

    useEffect(() => { initGrid(); }, []);

    const reveal = (r: number, c: number) => {
        if (gameOver || grid[r][c].flagged || grid[r][c].revealed) return;
        
        const newGrid = [...grid.map(row => [...row])];
        if (newGrid[r][c].isMine) {
            setGameOver(true);
            newGrid.forEach(row => row.forEach(cell => { if (cell.isMine) cell.revealed = true; }));
        } else {
            const floodFill = (row: number, col: number) => {
                if (row < 0 || row >= ROWS || col < 0 || col >= COLS || newGrid[row][col].revealed) return;
                newGrid[row][col].revealed = true;
                if (newGrid[row][col].neighborCount === 0) {
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) floodFill(row+dr, col+dc);
                    }
                }
            };
            floodFill(r, c);
        }
        setGrid(newGrid);

        // Win check
        const revealedCount = newGrid.flat().filter(cell => cell.revealed).length;
        if (revealedCount === ROWS * COLS - MINES) setWon(true);
    };

    const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
        e.preventDefault();
        if (gameOver || grid[r][c].revealed) return;
        const newGrid = [...grid.map(row => [...row])];
        newGrid[r][c].flagged = !newGrid[r][c].flagged;
        setGrid(newGrid);
    };

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-black md:pl-20 lg:pl-64">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111111_0%,transparent_100%)] opacity-50" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-6 py-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium"><ArrowLeft /></button>
                    <div className="text-center font-mono">
                        <h1 className="text-3xl font-black italic tracking-tighter text-emerald-400">DATA_RECOV</h1>
                        <p className="text-[8px] text-zinc-500 uppercase tracking-[0.6em] mt-1 anim-pulse">System Override Required</p>
                    </div>
                    <button onClick={initGrid} className="p-3 glass rounded-2xl border-premium"><RotateCcw /></button>
                </div>

                <div className="grid grid-cols-10 gap-1 p-2 bg-emerald-950/20 border border-emerald-500/20 rounded-3xl backdrop-blur-3xl shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                    {grid.map((row, r) => row.map((cell, c) => (
                        <button
                            key={`${r}-${c}`}
                            onClick={() => reveal(r, c)}
                            onContextMenu={(e) => toggleFlag(e, r, c)}
                            className={`aspect-square rounded-lg flex items-center justify-center text-sm font-black transition-all duration-300
                                ${cell.revealed 
                                    ? cell.isMine 
                                        ? 'bg-rose-500 animate-pulse' 
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 shadow-inner'
                                }
                                ${!cell.revealed && cell.flagged ? 'animate-bounce' : ''}
                            `}
                        >
                            {cell.revealed 
                                ? cell.isMine ? <Bomb className="w-4 h-4" /> : cell.neighborCount > 0 ? cell.neighborCount : ''
                                : cell.flagged ? <Flag className="w-3 h-3 text-emerald-500 shadow-[0_0_10px_theme(colors.emerald.500)]" /> : ''
                            }
                        </button>
                    )))}
                </div>

                <div className="p-4 rounded-3xl glass border-premium bg-emerald-500/5 flex items-center gap-4">
                    <Terminal className="w-5 h-5 text-emerald-500" />
                    <div className="flex-1 font-mono text-[10px] text-emerald-500/60 leading-tight">
                        &gt; Mines Detected: {MINES} <br />
                        &gt; Flags: {grid.flat().filter(c => c.flagged).length} <br />
                        &gt; R-Click to deploy intercept markers.
                    </div>
                </div>

                {won && (
                    <div className="absolute inset-0 z-[100] bg-emerald-950/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
                        <Terminal className="w-20 h-20 text-emerald-400 mb-6" />
                        <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase italic">Access Granted</h2>
                        <button onClick={initGrid} className="mt-8 px-12 py-3 bg-emerald-500 text-black font-black uppercase rounded-full">Next Node</button>
                    </div>
                )}
            </div>
        </div>
    );
}
