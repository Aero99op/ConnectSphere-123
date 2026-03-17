"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Shield, Zap, Skull, Crosshair } from "lucide-react";

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface Bullet {
    id: number;
    x: number;
    y: number;
    angle: number;
    speed: number;
}

export default function VoidGuardian() {
    const router = useRouter();
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
    const [score, setScore] = useState(0);
    const [playerPos, setPlayerPos] = useState({ x: 50, y: 70 }); // Percentages
    const [bullets, setBullets] = useState<Bullet[]>([]);
    const [particles, setParticles] = useState<Particle[]>([]);
    
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>();
    const bulletId = useRef(0);
    const pId = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const startGame = () => {
        setGameState('playing');
        setScore(0);
        setBullets([]);
        setParticles([]);
    };

    const spawnBullet = (time: number) => {
        const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
        let x = 0, y = 0;
        if (edge === 0) { x = Math.random() * 100; y = -5; }
        else if (edge === 1) { x = 105; y = Math.random() * 100; }
        else if (edge === 2) { x = Math.random() * 100; y = 105; }
        else { x = -5; y = Math.random() * 100; }

        const angle = Math.atan2(playerPos.y - y, playerPos.x - x);
        const speed = 0.2 + (score / 10000);

        setBullets(prev => [...prev, {
            id: bulletId.current++,
            x, y, angle, speed
        }]);
    };

    const createParticles = (x: number, y: number, color: string) => {
        const newParticles = Array.from({ length: 10 }).map(() => ({
            id: pId.current++,
            x, y,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            life: 1,
            color
        }));
        setParticles(prev => [...prev, ...newParticles]);
    };

    const update = useCallback((time: number) => {
        if (lastTimeRef.current !== undefined) {
            // Update Bullets
            setBullets(prev => {
                const next = prev.map(b => ({
                    ...b,
                    x: b.x + Math.cos(b.angle) * b.speed,
                    y: b.y + Math.sin(b.angle) * b.speed,
                })).filter(b => b.x > -10 && b.x < 110 && b.y > -10 && b.y < 110);

                // Collision
                const collision = next.find(b => {
                    const dx = b.x - playerPos.x;
                    const dy = b.y - playerPos.y;
                    return Math.sqrt(dx * dx + dy * dy) < 3;
                });

                if (collision) {
                    setGameState('gameover');
                    createParticles(playerPos.x, playerPos.y, 'text-rose-500');
                    return next;
                }
                return next;
            });

            // Update Particles
            setParticles(prev => prev.map(p => ({
                ...p,
                x: p.x + p.vx,
                y: p.y + p.vy,
                life: p.life - 0.02
            })).filter(p => p.life > 0));

            setScore(s => s + 1);

            if (Math.random() < 0.1 + (score / 50000)) {
                spawnBullet(time);
            }
        }
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(update);
    }, [playerPos, score]);

    useEffect(() => {
        if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
        else if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [gameState, update]);

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (gameState !== 'playing' || !containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;
        setPlayerPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    };

    return (
        <div 
            className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#020205] md:pl-20 lg:pl-64"
            style={{ touchAction: 'none' }}
        >
            {/* Deep Space Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,transparent_100%)] opacity-30" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
                
                {/* Moving Stars FX */}
                <div className="absolute inset-0 overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <div 
                            key={i}
                            className="absolute bg-white rounded-full animate-pulse"
                            style={{
                                width: Math.random() * 2 + 'px',
                                height: Math.random() * 2 + 'px',
                                left: Math.random() * 100 + '%',
                                top: Math.random() * 100 + '%',
                                opacity: Math.random(),
                                animationDelay: Math.random() * 5 + 's'
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="z-10 w-full max-w-xl px-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium"><ArrowLeft /></button>
                    <div className="text-center">
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase bg-gradient-to-r from-indigo-400 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]">Void Guardian</h1>
                        <p className="text-[10px] text-indigo-400/70 tracking-[0.5em] font-bold uppercase mt-1">Stellar Survival Protocol</p>
                    </div>
                    <button onClick={startGame} className="p-3 glass rounded-2xl border-premium"><RotateCcw /></button>
                </div>

                <div 
                    ref={containerRef}
                    onMouseMove={handleMouseMove}
                    onTouchMove={handleMouseMove}
                    className="relative aspect-square w-full glass rounded-[3rem] border-premium bg-zinc-950/60 overflow-hidden cursor-none shadow-[0_0_50px_rgba(0,0,0,0.8)]"
                >
                    {/* Bullets */}
                    {bullets.map(b => (
                        <div 
                            key={b.id}
                            className="absolute w-2 h-2 rounded-full bg-white shadow-[0_0_15px_#fff,0_0_30px_theme(colors.indigo.500)]"
                            style={{ left: b.x + '%', top: b.y + '%', transform: 'translate(-50%, -50%)' }}
                        />
                    ))}

                    {/* Particles */}
                    {particles.map(p => (
                        <div 
                            key={p.id}
                            className={`absolute w-1 h-1 rounded-full ${p.color} shadow-[0_0_10px_currentColor]`}
                            style={{ 
                                left: p.x + '%', 
                                top: p.y + '%', 
                                opacity: p.life,
                                transform: `translate(-50%, -50%) scale(${p.life * 2})`
                            }}
                        />
                    ))}

                    {/* Player */}
                    <div 
                        className="absolute z-50 pointer-events-none"
                        style={{ 
                            left: playerPos.x + '%', 
                            top: playerPos.y + '%', 
                            transform: 'translate(-50%, -50%)' 
                        }}
                    >
                        <div className="relative">
                            <Crosshair className="w-10 h-10 text-indigo-400 animate-spin-slow drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-md animate-pulse" />
                            {/* Shield FX */}
                            <div className="absolute -inset-2 border border-indigo-500/30 rounded-full animate-ping opacity-20" />
                        </div>
                    </div>

                    {/* UI Overlays */}
                    {gameState === 'idle' && (
                        <div className="absolute inset-0 z-[100] bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in">
                            <Shield className="w-20 h-20 text-indigo-400 mb-6 animate-pulse" />
                            <h2 className="text-3xl font-black italic text-white mb-2 tracking-tighter uppercase">Defend The Core</h2>
                            <p className="text-zinc-400 mb-8 max-w-xs text-center text-xs px-10">Guide the Void Core through the stellar storm. Survival is the only objective.</p>
                            <button onClick={startGame} className="px-12 py-4 bg-indigo-500 text-white font-black uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:scale-105 transition-transform">Initiate Guard</button>
                        </div>
                    )}

                    {gameState === 'gameover' && (
                        <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-[40px] flex flex-col items-center justify-center animate-in zoom-in duration-300">
                            <Skull className="w-20 h-20 text-rose-500 mb-6 animate-bounce" />
                            <h2 className="text-6xl font-black italic text-white mb-2 uppercase tracking-tighter">Core Breach</h2>
                            <p className="text-zinc-500 mb-8 font-mono tracking-widest uppercase text-sm">Integrity held for {score} Cycles</p>
                            <button onClick={startGame} className="px-10 py-4 bg-white text-black font-black uppercase rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]">Resynchronize</button>
                        </div>
                    )}
                </div>

                <div className="p-6 glass rounded-[3rem] border-premium bg-indigo-500/10 flex justify-between items-center">
                    <div className="flex gap-8">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Cycles</span>
                            <span className="text-3xl font-black text-indigo-400">{score}</span>
                        </div>
                        <div className="w-px h-10 bg-white/10" />
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Protocol</span>
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-tighter">Maximum Danger</span>
                        </div>
                    </div>
                    <Zap className={`w-8 h-8 text-amber-400 transition-opacity ${score % 100 < 50 ? 'opacity-100' : 'opacity-30'}`} />
                </div>
            </div>

            <style jsx>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 4s linear infinite;
                }
            `}</style>
        </div>
    );
}
