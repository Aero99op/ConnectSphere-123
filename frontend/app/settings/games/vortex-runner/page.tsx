"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Zap, Ghost, Eye } from "lucide-react";

export default function VortexRunner() {
    const router = useRouter();
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
    const [score, setScore] = useState(0);
    const [obstacles, setObstacles] = useState<{ id: number; angle: number; size: number; z: number }[]>([]);
    const [playerAngle, setPlayerAngle] = useState(0);
    
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>();
    const obsId = useRef(0);

    const startGame = () => {
        setGameState('playing');
        setScore(0);
        setObstacles([]);
        setPlayerAngle(0);
    };

    const update = useCallback((time: number) => {
        if (lastTimeRef.current !== undefined) {
            setObstacles(prev => {
                const next = prev.map(o => ({ ...o, z: o.z - 0.01 })).filter(o => o.z > 0.1);
                
                // Collision
                const collision = next.find(o => o.z < 0.25 && Math.abs(o.angle - playerAngle) < 0.4);
                if (collision) setGameState('gameover');
                
                return next;
            });

            if (time % 1000 < 50 && Math.random() < 0.2) {
                setObstacles(prev => [...prev, {
                    id: obsId.current++,
                    angle: Math.random() * Math.PI * 2,
                    size: 40,
                    z: 1.5
                }]);
            }
            setScore(s => s + 1);
        }
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(update);
    }, [playerAngle]);

    useEffect(() => {
        if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
        else if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [gameState, update]);

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;
            if (e.key === 'ArrowLeft') setPlayerAngle(a => a - 0.2);
            if (e.key === 'ArrowRight') setPlayerAngle(a => a + 0.2);
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [gameState]);

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-black md:pl-20 lg:pl-64">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1e1b4b_0%,transparent_70%)] opacity-40" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium"><ArrowLeft /></button>
                    <div className="text-center">
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">Vortex Runner</h1>
                        <p className="text-[10px] text-zinc-500 tracking-[0.5em] font-bold uppercase mt-1">Nth Dimension</p>
                    </div>
                    <button onClick={startGame} className="p-3 glass rounded-2xl border-premium"><RotateCcw /></button>
                </div>

                <div className="relative aspect-[3/4] w-full glass rounded-3xl border-premium bg-zinc-950/50 overflow-hidden perspective-1000">
                    <div className="absolute inset-0 flex items-center justify-center">
                        {/* Circular Tunnels */}
                        {[...Array(10)].map((_, i) => (
                            <div 
                                key={i}
                                className="absolute rounded-full border border-white/5"
                                style={{
                                    width: `${(i + 1) * 100}px`,
                                    height: `${(i + 1) * 100}px`,
                                    transform: `translateZ(${-i * 100}px)`,
                                    animation: `tunnelMove 3s linear infinite delay-${i}s`
                                }}
                            />
                        ))}

                        {/* Obstacles */}
                        {obstacles.map(obs => (
                            <div 
                                key={obs.id}
                                className="absolute w-12 h-12 bg-indigo-500/50 glass border-premium border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)] rounded-lg"
                                style={{
                                    transform: `rotate(${obs.angle}rad) translateY(-${150 * obs.z}px) scale(${obs.z})`,
                                    opacity: obs.z,
                                    zIndex: Math.floor(obs.z * 100)
                                }}
                            />
                        ))}

                        {/* Player */}
                        <div 
                            className="absolute z-50 flex flex-col items-center transition-transform duration-200"
                            style={{ transform: `rotate(${playerAngle}rad) translateY(-140px)` }}
                        >
                            <div className="w-8 h-8 bg-white shadow-[0_0_20px_#fff] rounded-full animate-pulse" />
                            <div className="w-1 h-32 bg-gradient-to-t from-transparent via-white/20 to-white/50" />
                        </div>
                    </div>

                    {gameState === 'idle' && (
                        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center">
                            <Eye className="w-16 h-16 text-indigo-400 mb-6 animate-pulse" />
                            <button onClick={startGame} className="px-12 py-4 bg-indigo-500 text-white font-black uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(99,102,241,0.6)]">Enter Vortex</button>
                        </div>
                    )}

                    {gameState === 'gameover' && (
                        <div className="absolute inset-0 z-[100] bg-zinc-950/90 backdrop-blur-3xl flex flex-col items-center justify-center animate-in zoom-in duration-300">
                            <h2 className="text-6xl font-black italic text-rose-500 mb-2 uppercase">Dissolved</h2>
                            <p className="text-zinc-500 mb-8 font-mono tracking-widest">T-Distance: {score}</p>
                            <button onClick={startGame} className="px-12 py-4 bg-white text-black font-black uppercase rounded-full">Re-materialize</button>
                        </div>
                    )}
                </div>

                <div className="p-6 glass rounded-3xl border-premium bg-indigo-500/5 flex justify-between items-center">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Traversed</span>
                        <span className="text-2xl font-black">{score} LM</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-zinc-400">Stable Flux</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes tunnelMove {
                    from { transform: translateZ(0); opacity: 0; }
                    50% { opacity: 0.5; }
                    to { transform: translateZ(1000px); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
