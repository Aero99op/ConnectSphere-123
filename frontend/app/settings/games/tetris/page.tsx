"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Play, Pause, Trophy } from "lucide-react";

const COLS = 10;
const ROWS = 20;
const INITIAL_SPEED = 800;

const TETROMINOS = {
    I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: "bg-cyan-500" },
    J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: "bg-blue-500" },
    L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: "bg-orange-500" },
    O: { shape: [[1, 1], [1, 1]], color: "bg-yellow-500" },
    S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: "bg-green-500" },
    T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: "bg-purple-500" },
    Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: "bg-red-500" },
};

export default function TetrisGame() {
    const router = useRouter();
    const [grid, setGrid] = useState<string[][]>(Array(ROWS).fill(null).map(() => Array(COLS).fill("")));
    const [activePiece, setActivePiece] = useState<{ pos: { x: number; y: number }; type: keyof typeof TETROMINOS; shape: number[][] } | null>(null);
    const [score, setScore] = useState(0);
    const [level, setLevel] = useState(1);
    const [gameOver, setGameOver] = useState(false);
    const [paused, setPaused] = useState(false);
    
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>(0);
    const dropCounterRef = useRef<number>(0);

    const spawnPiece = useCallback(() => {
        const types = Object.keys(TETROMINOS) as (keyof typeof TETROMINOS)[];
        const type = types[Math.floor(Math.random() * types.length)];
        const piece = {
            pos: { x: Math.floor(COLS / 2) - 1, y: 0 },
            type: type,
            shape: TETROMINOS[type].shape,
        };
        
        if (checkCollision(piece.pos.x, piece.pos.y, piece.shape)) {
            setGameOver(true);
            return null;
        }
        return piece;
    }, [grid]);

    const resetGame = () => {
        setGrid(Array(ROWS).fill(null).map(() => Array(COLS).fill("")));
        setScore(0);
        setLevel(1);
        setGameOver(false);
        setPaused(false);
        setActivePiece(spawnPiece());
    };

    const checkCollision = (x: number, y: number, shape: number[][], currentGrid = grid) => {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] !== 0) {
                    const newX = x + c;
                    const newY = y + r;
                    if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && currentGrid[newY][newX] !== "")) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const rotate = (shape: number[][]) => {
        const newShape = shape[0].map((_, i) => shape.map(row => row[i]).reverse());
        return newShape;
    };

    const merge = (piece: any) => {
        const newGrid = grid.map(row => [...row]);
        piece.shape.forEach((row: number[], r: number) => {
            row.forEach((value, c) => {
                if (value !== 0) {
                    const y = piece.pos.y + r;
                    const x = piece.pos.x + c;
                    if (y >= 0) newGrid[y][x] = TETROMINOS[piece.type as keyof typeof TETROMINOS].color;
                }
            });
        });

        // Clear Rows
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (newGrid[r].every(cell => cell !== "")) {
                newGrid.splice(r, 1);
                newGrid.unshift(Array(COLS).fill(""));
                cleared++;
                r++; // Check same row index again
            }
        }

        if (cleared > 0) {
            const points = [0, 100, 300, 500, 800][cleared] * level;
            setScore(s => s + points);
            if (score + points > level * 1000) setLevel(l => l + 1);
        }

        setGrid(newGrid);
        setActivePiece(spawnPiece());
    };

    const drop = useCallback(() => {
        if (!activePiece || gameOver || paused) return;
        if (!checkCollision(activePiece.pos.x, activePiece.pos.y + 1, activePiece.shape)) {
            setActivePiece(prev => prev ? { ...prev, pos: { ...prev.pos, y: prev.pos.y + 1 } } : null);
        } else {
            merge(activePiece);
        }
    }, [activePiece, gameOver, paused, grid, level]);

    const move = (dir: number) => {
        if (!activePiece || gameOver || paused) return;
        if (!checkCollision(activePiece.pos.x + dir, activePiece.pos.y, activePiece.shape)) {
            setActivePiece(prev => prev ? { ...prev, pos: { ...prev.pos, x: prev.pos.x + dir } } : null);
        }
    };

    const handleRotate = () => {
        if (!activePiece || gameOver || paused) return;
        const rotated = rotate(activePiece.shape);
        if (!checkCollision(activePiece.pos.x, activePiece.pos.y, rotated)) {
            setActivePiece(prev => prev ? { ...prev, shape: rotated } : null);
        }
    };

    const gameLoop = useCallback((time: number) => {
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;
        dropCounterRef.current += deltaTime;

        const speed = Math.max(100, INITIAL_SPEED - (level - 1) * 100);
        if (dropCounterRef.current > speed) {
            drop();
            dropCounterRef.current = 0;
        }
        requestRef.current = requestAnimationFrame(gameLoop);
    }, [drop, level]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(gameLoop);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [gameLoop]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') move(-1);
            else if (e.key === 'ArrowRight') move(1);
            else if (e.key === 'ArrowDown') drop();
            else if (e.key === 'ArrowUp') handleRotate();
            else if (e.key === ' ') setPaused(p => !p);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activePiece, gameOver, paused, level]);

    useEffect(() => {
        setActivePiece(spawnPiece());
    }, []);

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 md:pl-20 lg:pl-64 justify-center overflow-hidden">
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-md py-6 md:py-10 flex flex-col gap-6 z-10 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-3xl font-display font-black tracking-tight italic bg-gradient-to-br from-white to-purple-500 bg-clip-text text-transparent uppercase">Tetris</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setPaused(!paused)} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                            {paused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                        </button>
                        <button onClick={resetGame} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                            <RotateCcw className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-2xl glass border-premium flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Score</span>
                        <span className="text-xl font-bold">{score}</span>
                    </div>
                    <div className="p-3 rounded-2xl glass border-premium flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Level</span>
                        <span className="text-xl font-bold">{level}</span>
                    </div>
                </div>

                <div className="relative mx-auto bg-zinc-900/80 backdrop-blur-xl p-1 rounded-2xl border-4 border-white/5 shadow-2xl overflow-hidden" style={{ width: '240px', height: '480px' }}>
                    <div className="grid grid-cols-10 grid-rows-20 w-full h-full gap-px bg-white/5">
                        {grid.map((row, y) => (
                            row.map((cell, x) => {
                                let color = cell;
                                // Draw active piece
                                if (activePiece) {
                                    activePiece.shape.forEach((pRow, r) => {
                                        pRow.forEach((value, c) => {
                                            if (value !== 0 && activePiece.pos.y + r === y && activePiece.pos.x + c === x) {
                                                color = TETROMINOS[activePiece.type].color;
                                            }
                                        });
                                    });
                                }
                                return (
                                    <div key={`${x}-${y}`} className={`w-full h-full rounded-sm ${color || 'bg-black/20'} transition-colors duration-100 relative`}>
                                        {color && <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20 skew-y-[-10deg] translate-y-[-50%]" />}
                                    </div>
                                );
                            })
                        ))}
                    </div>

                    {(gameOver || paused) && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                            <h2 className="text-3xl font-black mb-4">
                                {gameOver ? "Game Over! 💀" : "Paused ☕"}
                            </h2>
                            <button onClick={gameOver ? resetGame : () => setPaused(false)} className="px-8 py-3 rounded-2xl bg-purple-600 text-white font-bold hover:scale-105 transition-transform">
                                {gameOver ? "Try Again" : "Continue"}
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-zinc-500 text-center text-xs">
                    <span className="text-white font-bold">Arrow Keys</span> to Move/Rotate. <br/>
                    <span className="text-white font-bold">Space</span> to Pause.
                </p>
            </div>
        </div>
    );
}
