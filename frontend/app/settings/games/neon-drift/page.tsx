"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Zap, Trophy, Timer, Gauge } from "lucide-react";

const LANES = [-1.5, 0, 1.5];
const PLAYER_Y = 0.8;
const INITIAL_SPEED = 0.02;
const MAX_SPEED = 0.08;

interface Obstacle {
    id: number;
    lane: number;
    z: number;
    color: string;
}

export default function NeonDrift() {
    const router = useRouter();
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
    const [score, setScore] = useState(0);
    const [speed, setSpeed] = useState(INITIAL_SPEED);
    const [lane, setLane] = useState(1); // 0, 1, 2
    const [obstacles, setObstacles] = useState<Obstacle[]>([]);
    const [highScore, setHighScore] = useState(0);
    const [shake, setShake] = useState(false);
    
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>();
    const obsId = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const startGame = () => {
        setGameState('playing');
        setScore(0);
        setSpeed(INITIAL_SPEED);
        setLane(1);
        setObstacles([]);
    };

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 200);
    };

    const update = useCallback((time: number) => {
        if (lastTimeRef.current !== undefined) {
            setObstacles(prev => {
                const next = prev.map(o => ({ ...o, z: o.z - speed })).filter(o => o.z > -1);
                
                // Collision check
                const collision = next.find(o => o.z < 0.1 && o.z > -0.1 && o.lane === LANES[lane]);
                if (collision) {
                    setGameState('gameover');
                    triggerShake();
                    return next;
                }
                
                return next;
            });

            // Difficulty progression
            setSpeed(s => Math.min(MAX_SPEED, s + 0.00001));
            setScore(s => s + 1);

            // Spawn obstacles
            if (Math.random() < 0.05 + (speed * 0.5)) {
                setObstacles(prev => {
                    if (prev.length > 0 && prev[prev.length - 1].z > 3) return prev;
                    return [...prev, {
                        id: obsId.current++,
                        lane: LANES[Math.floor(Math.random() * 3)],
                        z: 10,
                        color: ['bg-rose-500', 'bg-cyan-400', 'bg-purple-500'][Math.floor(Math.random() * 3)]
                    }];
                });
            }
        }
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(update);
    }, [speed, lane]);

    useEffect(() => {
        if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
        else if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [gameState, update]);

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;
            if (e.key === 'ArrowLeft') setLane(l => Math.max(0, l - 1));
            if (e.key === 'ArrowRight') setLane(l => Math.min(2, l + 1));
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [gameState]);

    useEffect(() => {
        if (score > highScore) setHighScore(score);
    }, [score, highScore]);

    return (
        <div className={`flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-black md:pl-20 lg:pl-64 transition-transform ${shake ? 'animate-shake' : ''}`}>
            {/* Super High-Fidelity Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#1e1b4b_0%,transparent_60%)] opacity-60" />
                
                {/* Cyber Grid / Road */}
                <div className="absolute inset-0 perspective-[500px] overflow-hidden">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-[150%] origin-bottom rotate-x-[65deg]">
                        <div className="w-full h-full bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:100px_100px] animate-grid" />
                        
                        {/* Lane markings */}
                        <div className="absolute inset-0 flex justify-center gap-[200px]">
                            <div className="w-2 h-full bg-cyan-500/30 blur-sm" />
                            <div className="w-2 h-full bg-cyan-500/30 blur-sm" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="z-10 w-full max-w-2xl px-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium hover:bg-white/10 transition-all"><ArrowLeft /></button>
                    <div className="text-center">
                        <h1 className="text-5xl font-black italic tracking-tighter uppercase bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">Neon Drift</h1>
                        <p className="text-[10px] text-cyan-500/70 tracking-[0.5em] font-bold uppercase mt-1">Experimental High-Speed Protocol</p>
                    </div>
                    <button onClick={startGame} className="p-3 glass rounded-2xl border-premium hover:rotate-180 transition-transform duration-500"><RotateCcw /></button>
                </div>

                <div className="relative aspect-video w-full glass rounded-[2.5rem] border-premium bg-zinc-950/40 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] perspective-[1000px]">
                    {/* Game World */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        
                        {/* Infinite Road Perspective */}
                        <div className="absolute inset-0 perspective-[400px]">
                            {/* Obstacles Rendering */}
                            {obstacles.map(obs => {
                                const scale = 1 / (obs.z * 0.2 + 1);
                                const opacity = Math.min(1, 5 / obs.z);
                                return (
                                    <div 
                                        key={obs.id}
                                        className={`absolute w-32 h-12 ${obs.color} border-t-2 border-white/30 rounded-lg shadow-[0_0_40px_${obs.color.replace('bg-', '')}] transition-all duration-75`}
                                        style={{
                                            transform: `translateX(${obs.lane * 150 * scale}px) translateY(${150 * (1 - scale)}px) scale(${scale})`,
                                            zIndex: Math.floor((10 - obs.z) * 10),
                                            opacity: opacity
                                        }}
                                    >
                                        <div className="w-full h-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                                            <Zap className="w-4 h-4 text-white animate-pulse" />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Player Car - High Fidelity */}
                            <div 
                                className="absolute bottom-[20%] left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-300 ease-out"
                                style={{ transform: `translateX(${LANES[lane] * 120}px)` }}
                            >
                                {/* Glow Under */}
                                <div className="absolute -bottom-4 w-24 h-8 bg-cyan-500/40 blur-xl animate-pulse rounded-full" />
                                
                                {/* Car Body */}
                                <div className="relative w-20 h-10 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-lg border-t-2 border-white/50 shadow-[0_0_30px_rgba(34,211,238,0.6)]">
                                    <div className="absolute top-1 left-1 right-1 h-3 bg-black/40 rounded-t-md" />
                                    {/* Tail Lights */}
                                    <div className="absolute -bottom-1 left-2 w-4 h-2 bg-rose-500 blur-[2px]" />
                                    <div className="absolute -bottom-1 right-2 w-4 h-2 bg-rose-500 blur-[2px]" />
                                </div>

                                {/* Speed Trails */}
                                {speed > 0.04 && (
                                    <div className="absolute -bottom-32 flex gap-12 opacity-50">
                                        <div className="w-1 h-32 bg-gradient-to-t from-transparent via-cyan-500/30 to-cyan-500" />
                                        <div className="w-1 h-32 bg-gradient-to-t from-transparent via-cyan-500/30 to-cyan-500" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Motion Blur FX */}
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,transparent_0%,rgba(34,211,238,0.05)_50%,transparent_100%)] animate-pulse" />
                    </div>

                    {/* UI Overlays */}
                    {gameState === 'idle' && (
                        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in">
                            <Gauge className="w-20 h-20 text-cyan-400 mb-6 animate-pulse" />
                            <h2 className="text-3xl font-black italic text-white mb-2 tracking-tighter uppercase">Neon Drift Ready</h2>
                            <p className="text-zinc-400 mb-8 max-w-xs text-center text-xs px-10">Use Arrow Keys to drift between lanes. Avoid all energy barriers at max velocity.</p>
                            <button onClick={startGame} className="group relative px-12 py-4 bg-cyan-500 text-black font-black uppercase tracking-widest rounded-full overflow-hidden hover:scale-105 transition-all">
                                <span className="relative z-10 text-white">Engage Drive</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                            </button>
                        </div>
                    )}

                    {gameState === 'gameover' && (
                        <div className="absolute inset-0 z-[100] bg-rose-950/40 backdrop-blur-[20px] flex flex-col items-center justify-center animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 border border-rose-500/50 shadow-[0_0_40px_rgba(244,63,94,0.4)]">
                                <Zap className="w-10 h-10 text-rose-500" />
                            </div>
                            <h2 className="text-6xl font-black italic text-white mb-2 uppercase tracking-tighter drop-shadow-lg">Wrecked</h2>
                            <p className="text-rose-200/60 mb-8 font-mono tracking-widest uppercase text-sm">Velocity Impact at {score} Pixels</p>
                            <div className="flex gap-4">
                                <button onClick={startGame} className="px-10 py-4 bg-white text-black font-black uppercase rounded-full hover:scale-105 transition-transform">Retry</button>
                                <button onClick={() => router.back()} className="px-10 py-4 glass border-white/20 text-white font-black uppercase rounded-full hover:bg-white/10 transition-colors">Exit</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Dashboard */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-6 glass rounded-[2rem] border-premium bg-cyan-500/5 flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Traversed</span>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-cyan-400">{score}</span>
                            <span className="text-xs font-bold text-zinc-600 mb-1">Meters</span>
                        </div>
                    </div>
                    <div className="p-6 glass rounded-[2rem] border-premium bg-purple-500/5 flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Velocity</span>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-purple-400">{Math.floor(speed * 10000)}</span>
                            <span className="text-xs font-bold text-zinc-600 mb-1">KM/H</span>
                        </div>
                    </div>
                    <div className="p-6 glass rounded-[2rem] border-premium bg-amber-500/5 flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Max Record</span>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-amber-400">{highScore}</span>
                            <span className="text-xs font-bold text-zinc-600 mb-1">Meters</span>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes grid-scroll {
                    from { background-position: 0 0; }
                    to { background-position: 0 100px; }
                }
                .animate-grid {
                    animation: grid-scroll 2s linear infinite;
                }
                @keyframes shake {
                    0%, 100% { transform: translate(0, 0); }
                    10%, 30%, 50%, 70%, 90% { transform: translate(-4px, 0); }
                    20%, 40%, 60%, 80% { transform: translate(4px, 0); }
                }
                .animate-shake {
                    animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
                }
                .perspective-1000 { perspective: 1000px; }
                .rotate-x-65 { transform: rotateX(65deg); }
                @keyframes blur-pulse {
                    0%, 100% { opacity: 0.1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}
