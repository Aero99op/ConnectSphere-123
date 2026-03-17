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
    const [flagMode, setFlagMode] = useState(false);

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
        setFlagMode(false);
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

    const toggleFlag = (e: React.MouseEvent | React.TouchEvent, r: number, c: number) => {
        if (e) e.preventDefault();
        if (gameOver || grid[r][c].revealed) return;
        const newGrid = [...grid.map(row => [...row])];
        newGrid[r][c].flagged = !newGrid[r][c].flagged;
        setGrid(newGrid);
    };

    const handleCellClick = (r: number, c: number) => {
        if (flagMode) {
            const newGrid = [...grid.map(row => [...row])];
            newGrid[r][c].flagged = !newGrid[r][c].flagged;
            setGrid(newGrid);
        } else {
            reveal(r, c);
        }
    };

    return (
        <div 
            className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-black md:pl-20 lg:pl-64"
            style={{ touchAction: 'none' }}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111111_0%,transparent_100%)] opacity-50" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-6 py-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium transition-transform hover:scale-110"><ArrowLeft /></button>
                    <div className="text-center font-mono">
                        <h1 className="text-3xl font-black italic tracking-tighter text-emerald-400">DATA_RECOV</h1>
                        <p className="text-[8px] text-zinc-500 uppercase tracking-[0.6em] mt-1 anim-pulse">System Override Required</p>
                    </div>
                    <button onClick={initGrid} className="p-3 glass rounded-2xl border-premium hover:rotate-180 transition-transform duration-500"><RotateCcw /></button>
                </div>

                <div className="grid grid-cols-10 gap-1 p-2 bg-emerald-950/20 border border-emerald-500/20 rounded-3xl backdrop-blur-3xl shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                    {grid.map((row, r) => row.map((cell, c) => (
                        <button
                            key={`${r}-${c}`}
                            onMouseDown={(e) => {
                                if (e.button === 0) handleCellClick(r, c);
                                else if (e.button === 2) toggleFlag(e, r, c);
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            className={`aspect-square rounded-lg flex items-center justify-center text-sm font-black transition-all duration-300
                                ${cell.revealed 
                                    ? cell.isMine 
                                        ? 'bg-rose-500 animate-pulse' 
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 shadow-inner'
                                }
                                ${!cell.revealed && cell.flagged ? 'animate-bounce' : ''}
                                ${flagMode && !cell.revealed ? 'ring-1 ring-emerald-500/40' : ''}
                            `}
                        >
                            {cell.revealed 
                                ? cell.isMine ? <Bomb className="w-4 h-4" /> : cell.neighborCount > 0 ? cell.neighborCount : ''
                                : cell.flagged ? <Flag className="w-3 h-3 text-emerald-500 shadow-[0_0_10px_theme(colors.emerald.500)]" /> : ''
                            }
                        </button>
                    )))}
                </div>

                <div className="flex gap-4">
                    <button 
                        onMouseDown={(e) => { e.preventDefault(); setFlagMode(!flagMode); }}
                        onTouchStart={(e) => { e.preventDefault(); setFlagMode(!flagMode); }}
                        className={`flex-1 p-6 rounded-3xl border transition-all flex items-center justify-center gap-4 font-bold uppercase tracking-widest text-xs
                            ${flagMode ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'glass border-premium text-zinc-500'}
                        `}
                    >
                        <Flag className={`w-5 h-5 ${flagMode ? 'animate-bounce text-black' : 'text-emerald-500'}`} />
                        {flagMode ? "Flag Active" : "Discovery Mode"}
                    </button>
                </div>

                <div className="p-4 rounded-3xl glass border-premium bg-emerald-500/5 flex items-center gap-4">
                    <Terminal className="w-5 h-5 text-emerald-500" />
                    <div className="flex-1 font-mono text-[10px] text-emerald-500/60 leading-tight">
                        &gt; Mines Detected: {MINES} <br />
                        &gt; Flags: {grid.flat().filter(c => c.flagged).length} <br />
                        &gt; {flagMode ? "TAP TO FLAG" : "TAP TO REVEAL | FLIP MODE TO FLAG"}
                    </div>
                </div>

                {won && (
                    <div className="absolute inset-0 z-[100] bg-emerald-950/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
                        <Terminal className="w-20 h-20 text-emerald-400 mb-6" />
                        <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase italic">Access Granted</h2>
                        <button onClick={initGrid} className="mt-8 px-12 py-3 bg-emerald-500 text-black font-black uppercase rounded-full tracking-widest hover:scale-110 transition-transform">Next Node</button>
                    </div>
                )}

                {gameOver && !won && (
                    <div className="absolute inset-0 z-[100] bg-rose-950/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
                        <Bomb className="w-20 h-20 text-rose-500 mb-6 animate-pulse" />
                        <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase italic">System Breach</h2>
                        <button onClick={initGrid} className="mt-8 px-12 py-3 bg-rose-500 text-white font-black uppercase rounded-full tracking-widest hover:scale-110 transition-transform">Reboot</button>
                    </div>
                )}
            </div>
            
            <style jsx>{`
                @keyframes anim-pulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 1; }
                }
                .anim-pulse {
                    animation: anim-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>
        </div>
    );
}
