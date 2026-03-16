"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Rocket, Flame, Target } from "lucide-react";

export default function GalaxyShooter() {
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);

    const state = useRef({
        playerX: 300,
        playerY: 500,
        bullets: [] as { x: number; y: number }[],
        enemies: [] as { x: number; y: number; hp: number; type: number }[],
        particles: [] as { x: number; y: number; vx: number; vy: number; color: string; life: number }[],
        lastShot: 0,
        canvasWidth: 600,
        canvasHeight: 600
    });

    const createExplosion = (x: number, y: number, color: string) => {
        for (let i = 0; i < 15; i++) {
            state.current.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                color,
                life: 1.0
            });
        }
    };

    const update = useCallback((time: number) => {
        if (gameOver) return;
        const s = state.current;

        // Move bullets
        s.bullets = s.bullets.filter(b => b.y > 0);
        s.bullets.forEach(b => b.y -= 10);

        // Move enemies
        if (Math.random() < 0.05) {
            s.enemies.push({ 
                x: Math.random() * (s.canvasWidth - 40) + 20, 
                y: -40, 
                hp: 1, 
                type: Math.floor(Math.random() * 3) 
            });
        }

        s.enemies = s.enemies.filter(e => e.y < s.canvasHeight);
        s.enemies.forEach(e => {
            e.y += 3;
            if (e.y > s.canvasHeight - 60 && Math.abs(e.x - s.playerX) < 40) {
                setGameOver(true);
            }
        });

        // Collision detection
        s.bullets.forEach((b, bi) => {
            s.enemies.forEach((e, ei) => {
                const dist = Math.hypot(b.x - e.x, b.y - e.y);
                if (dist < 30) {
                    s.bullets.splice(bi, 1);
                    s.enemies.splice(ei, 1);
                    setScore(prev => prev + 100);
                    createExplosion(e.x, e.y, "#ef4444");
                }
            });
        });

        // Update particles
        s.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
        });
        s.particles = s.particles.filter(p => p.life > 0);

    }, [gameOver]);

    const draw = useCallback((ctx: CanvasRenderingContext2D) => {
        const s = state.current;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(0, 0, s.canvasWidth, s.canvasHeight);

        // Draw Player
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#3b82f6";
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.moveTo(s.playerX, s.playerY - 20);
        ctx.lineTo(s.playerX - 25, s.playerY + 20);
        ctx.lineTo(s.playerX + 25, s.playerY + 20);
        ctx.fill();

        // Engine glow
        ctx.shadowColor = "#f59e0b";
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(s.playerX, s.playerY + 25 + Math.random() * 5, 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw Bullets
        ctx.shadowColor = "#0ea5e9";
        ctx.fillStyle = "#fff";
        s.bullets.forEach(b => {
            ctx.fillRect(b.x - 2, b.y, 4, 15);
        });

        // Draw Enemies
        s.enemies.forEach(e => {
            ctx.shadowColor = "#ef4444";
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.moveTo(e.x, e.y + 20);
            ctx.lineTo(e.x - 20, e.y - 20);
            ctx.lineTo(e.x + 20, e.y - 20);
            ctx.fill();
        });

        // Draw Particles
        s.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        ctx.globalAlpha = 1.0;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId: number;
        const render = (time: number) => {
            update(time);
            draw(ctx);
            frameId = requestAnimationFrame(render);
        };
        frameId = requestAnimationFrame(render);

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            state.current.playerX = (clientX - rect.left) * (state.current.canvasWidth / rect.width);
            
            // Auto shoot
            if (Date.now() - state.current.lastShot > 150) {
                state.current.bullets.push({ x: state.current.playerX, y: state.current.playerY - 20 });
                state.current.lastShot = Date.now();
            }
        };

        canvas.addEventListener('mousemove', handleMove);
        canvas.addEventListener('touchmove', handleMove);

        return () => {
            cancelAnimationFrame(frameId);
            canvas.removeEventListener('mousemove', handleMove);
            canvas.removeEventListener('touchmove', handleMove);
        };
    }, [update, draw]);

    const reset = () => {
        state.current.enemies = [];
        state.current.bullets = [];
        state.current.particles = [];
        setScore(0);
        setGameOver(false);
    };

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-zinc-950 md:pl-20 lg:pl-64">
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,#1e1b4b_0%,transparent_70%)] opacity-30" />
            </div>

            <div className="z-10 w-full max-w-2xl px-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium"><ArrowLeft /></button>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Galaxy Shooter</h1>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black text-center">Sector 7 Guard</p>
                    </div>
                    <button onClick={reset} className="p-3 glass rounded-2xl border-premium"><RotateCcw /></button>
                </div>

                <div className="relative glass p-1 rounded-3xl border-premium overflow-hidden bg-black/80 aspect-square">
                    <canvas ref={canvasRef} width={600} height={600} className="w-full h-full cursor-none touch-none" />
                    
                    <div className="absolute top-8 left-8 flex items-baseline gap-2">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Score</span>
                        <span className="text-4xl font-black italic tracking-tighter">{score.toLocaleString()}</span>
                    </div>

                    {gameOver && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-xl animate-in fade-in zoom-in duration-500">
                            <h2 className="text-6xl font-black italic tracking-tighter uppercase text-rose-500 mb-2">Obliterated</h2>
                            <p className="text-zinc-500 mb-8 uppercase tracking-widest font-bold">The galaxy has fallen with score: {score}</p>
                            <button onClick={reset} className="px-12 py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-110 transition-transform">
                                Try Again
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-center gap-8 p-6 glass rounded-3xl border-premium bg-white/5">
                    <div className="flex items-center gap-3">
                        <Rocket className="w-5 h-5 text-indigo-400" />
                        <span className="text-xs font-medium text-zinc-400">Move ship to navigate & auto-fire</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-3">
                        <Target className="w-5 h-5 text-rose-400" />
                        <span className="text-xs font-medium text-zinc-400">Destroy enemy invaders</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
