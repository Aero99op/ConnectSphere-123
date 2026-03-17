"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Zap, ShieldAlert } from "lucide-react";

export default function CyberRacer() {
    const router = useRouter();
    const [lane, setLane] = useState(1); // 0, 1, 2
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
    const [obstacles, setObstacles] = useState<{ id: number; lane: number; y: number }[]>([]);
    const [speed, setSpeed] = useState(5);

    const startGame = () => {
        setScore(0);
        setLane(1);
        setObstacles([]);
        setSpeed(5);
        setGameState('playing');
    };

    useEffect(() => {
        if (gameState !== 'playing') return;

        const interval = setInterval(() => {
            setObstacles(prev => {
                const moved = prev.map(obs => ({ ...obs, y: obs.y + speed }));
                const filtered = moved.filter(obs => obs.y < 700);
                
                // Spawn new
                if (Math.random() > 0.95 && filtered.length < 5) {
                    filtered.push({ id: Date.now(), lane: Math.floor(Math.random() * 3), y: -100 });
                }
                
                // Collision
                const playerY = 500;
                const collision = filtered.some(obs => 
                    obs.lane === lane && 
                    obs.y > playerY - 40 && 
                    obs.y < playerY + 40
                );

                if (collision) {
                    setGameState('gameover');
                    return prev;
                }

                return filtered;
            });

            setScore(s => s + 1);
            setSpeed(prev => Math.min(prev + 0.001, 15));
        }, 16);

        return () => clearInterval(interval);
    }, [gameState, lane, speed]);

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') setLane(l => Math.max(0, l - 1));
            if (e.key === 'ArrowRight') setLane(l => Math.min(2, l + 1));
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, []);

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-black md:pl-20 lg:pl-64">
            <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#1e1b4b_1px,transparent_1px),linear-gradient(to_bottom,#1e1b4b_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium"><ArrowLeft /></button>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">Cyber Racer</h1>
                    <div className="w-10" />
                </div>

                <div className="relative w-full h-[600px] rounded-3xl overflow-hidden border-4 border-cyan-500/20 bg-zinc-900/50 backdrop-blur-xl">
                    <div className="absolute inset-y-0 left-1/3 w-px bg-cyan-500/10" />
                    <div className="absolute inset-y-0 right-1/3 w-px bg-cyan-500/10" />

                    <div 
                        className="absolute bottom-10 w-20 h-24 transition-all duration-200 ease-out"
                        style={{ left: `calc(${lane * 33.33}% + 16.66% - 40px)` }}
                    >
                        <div className="h-full w-full bg-gradient-to-b from-cyan-400 to-blue-600 rounded-t-full rounded-b-lg shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-4 h-8 bg-orange-500 blur-lg animate-pulse" />
                        </div>
                    </div>

                    {obstacles.map(obs => (
                        <div 
                            key={obs.id}
                            className="absolute w-20 h-20 flex items-center justify-center"
                            style={{ 
                                left: `calc(${obs.lane * 33.33}% + 16.66% - 40px)`,
                                top: `${obs.y}px`
                            }}
                        >
                            <div className="w-16 h-16 bg-red-500/20 border-2 border-red-500 rounded-2xl rotate-45 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                                <ShieldAlert className="w-8 h-8 text-red-500 -rotate-45" />
                            </div>
                        </div>
                    ))}

                    {gameState === 'idle' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                            <Zap className="w-16 h-16 text-cyan-400 mb-4 animate-bounce" />
                            <button onClick={startGame} className="px-12 py-4 bg-cyan-500 text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                                Link Start
                            </button>
                        </div>
                    )}

                    {gameState === 'gameover' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/40 backdrop-blur-md">
                            <h2 className="text-6xl font-black italic text-white uppercase tracking-tighter mb-2">Wasted</h2>
                            <p className="text-xl text-red-200 mb-8 font-mono tracking-widest uppercase">Score: {score}</p>
                            <button onClick={startGame} className="px-12 py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform">
                                Respawn
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center p-6 glass rounded-3xl border-premium bg-cyan-500/5">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold">Protocol</span>
                        <span className="text-2xl font-black font-mono tracking-tighter">{score.toLocaleString().padStart(8, '0')}</span>
                    </div>
                </div>

                {/* Mobile Controls */}
                <div className="flex gap-4 md:hidden">
                    <button 
                        onMouseDown={(e) => { e.preventDefault(); setLane(l => Math.max(0, l - 1)); }}
                        onTouchStart={(e) => { e.preventDefault(); setLane(l => Math.max(0, l - 1)); }}
                        className="flex-1 h-20 glass rounded-3xl border-premium flex items-center justify-center active:scale-95 transition-all text-4xl"
                    >←</button>
                    <button 
                        onMouseDown={(e) => { e.preventDefault(); setLane(l => Math.min(2, l + 1)); }}
                        onTouchStart={(e) => { e.preventDefault(); setLane(l => Math.min(2, l + 1)); }}
                        className="flex-1 h-20 glass rounded-3xl border-premium flex items-center justify-center active:scale-95 transition-all text-4xl"
                    >→</button>
                </div>
            </div>

            <style jsx>{`
                @keyframes roadMove {
                    from { top: -100px; }
                    to { top: 700px; }
                }
            `}</style>
        </div>
    );
}
