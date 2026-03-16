"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Zap, Globe, Star } from "lucide-react";

export default function AstroBreakout() {
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [gameOver, setGameOver] = useState(false);

    const state = useRef({
        paddleX: 250,
        paddleWidth: 100,
        ballX: 300,
        ballY: 400,
        ballDX: 4,
        ballDY: -4,
        bricks: [] as { x: number; y: number; active: boolean; color: string }[],
        canvasWidth: 600,
        canvasHeight: 500
    });

    const initBricks = () => {
        const bricks = [];
        const colors = ["#818cf8", "#6366f1", "#4f46e5", "#4338ca"];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 8; c++) {
                bricks.push({ x: c * 70 + 20, y: r * 30 + 50, active: true, color: colors[r % colors.length] });
            }
        }
        state.current.bricks = bricks;
        state.current.ballX = 300;
        state.current.ballY = 400;
        state.current.ballDX = 4;
        state.current.ballDY = -4;
        setGameOver(false);
        setLives(3);
        setScore(0);
    };

    useEffect(() => { initBricks(); }, []);

    const update = useCallback(() => {
        if (gameOver) return;
        const s = state.current;

        s.ballX += s.ballDX;
        s.ballY += s.ballDY;

        // Wall bounce
        if (s.ballX < 10 || s.ballX > s.canvasWidth - 10) s.ballDX *= -1;
        if (s.ballY < 10) s.ballDY *= -1;

        // Paddle bounce
        if (s.ballY > s.canvasHeight - 30 && s.ballX > s.paddleX && s.ballX < s.paddleX + s.paddleWidth) {
            s.ballDY *= -1;
            s.ballDX = (s.ballX - (s.paddleX + s.paddleWidth / 2)) * 0.15;
        }

        // Brick collision
        s.bricks.forEach(b => {
            if (b.active && s.ballX > b.x && s.ballX < b.x + 60 && s.ballY > b.y && s.ballY < b.y + 20) {
                b.active = false;
                s.ballDY *= -1;
                setScore(prev => prev + 50);
            }
        });

        // Floor
        if (s.ballY > s.canvasHeight) {
            if (lives > 1) {
                setLives(l => l - 1);
                s.ballX = s.paddleX + s.paddleWidth / 2;
                s.ballY = s.canvasHeight - 40;
                s.ballDX = 4;
                s.ballDY = -4;
            } else {
                setGameOver(true);
            }
        }
    }, [gameOver, lives]);

    const draw = useCallback((ctx: CanvasRenderingContext2D) => {
        const s = state.current;
        ctx.clearRect(0, 0, s.canvasWidth, s.canvasHeight);

        // Draw Paddle
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#3b82f6";
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.roundRect(s.paddleX, s.canvasHeight - 20, s.paddleWidth, 10, 5);
        ctx.fill();

        // Draw Ball
        ctx.shadowColor = "#fff";
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.ballX, s.ballY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw Bricks
        s.bricks.forEach(b => {
            if (b.active) {
                ctx.shadowColor = b.color;
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.roundRect(b.x, b.y, 60, 20, 4);
                ctx.fill();
            }
        });
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId: number;
        const render = () => {
            update();
            draw(ctx);
            frameId = requestAnimationFrame(render);
        };
        render();

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const x = (clientX - rect.left) * (state.current.canvasWidth / rect.width);
            state.current.paddleX = Math.max(0, Math.min(state.current.canvasWidth - state.current.paddleWidth, x - state.current.paddleWidth / 2));
        };
        canvas.addEventListener('mousemove', handleMove);
        canvas.addEventListener('touchmove', handleMove);
        return () => {
            cancelAnimationFrame(frameId);
            canvas.removeEventListener('mousemove', handleMove);
            canvas.removeEventListener('touchmove', handleMove);
        };
    }, [update, draw]);

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-zinc-950 md:pl-20 lg:pl-64 py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1e3a8a_0%,transparent_70%)] opacity-30" />
            
            <div className="z-10 w-full max-w-2xl px-4 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium transition-transform hover:scale-110"><ArrowLeft /></button>
                    <div className="text-center">
                        <h1 className="text-4xl font-black italic tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent uppercase">Astro Breakout</h1>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-[0.4em] uppercase mt-1">Stellar Demolition</p>
                    </div>
                    <button onClick={initBricks} className="p-3 glass rounded-2xl border-premium hover:rotate-180 transition-transform duration-500"><RotateCcw /></button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-3xl glass border-premium flex flex-col items-center">
                        <Zap className="w-5 h-5 text-amber-500 mb-1" />
                        <span className="text-lg font-black">{score}</span>
                        <span className="text-[10px] uppercase text-zinc-500 font-bold">Points</span>
                    </div>
                    <div className="p-4 rounded-3xl glass border-premium flex flex-col items-center">
                        <Globe className="w-5 h-5 text-indigo-500 mb-1" />
                        <span className="text-lg font-black flex gap-1">
                            {[...Array(3)].map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < lives ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-700'}`} />
                            ))}
                        </span>
                        <span className="text-[10px] uppercase text-zinc-500 font-bold">Shields</span>
                    </div>
                    <div className="p-4 rounded-3xl glass border-premium flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-blue-500 blur-sm animate-pulse mb-1" />
                        <span className="text-lg font-black">{Math.floor(score / 400) + 1}</span>
                        <span className="text-[10px] uppercase text-zinc-500 font-bold">Orbit</span>
                    </div>
                </div>

                <div className="relative glass p-1 rounded-3xl border-premium bg-black/40 shadow-2xl overflow-hidden aspect-[6/5]">
                    <canvas ref={canvasRef} width={600} height={500} className="w-full h-full cursor-none touch-none" />
                    
                    {gameOver && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-500">
                            <h2 className="text-6xl font-black text-rose-500 uppercase italic tracking-tighter mb-2">System Failure</h2>
                            <p className="text-zinc-500 mb-8 font-mono tracking-widest uppercase">Impact Archive: {score}</p>
                            <button onClick={initBricks} className="px-12 py-4 bg-white text-black font-black uppercase rounded-full hover:scale-105 transition-transform">Re-Ignite</button>
                        </div>
                    )}
                </div>

                <div className="p-6 rounded-3xl glass border-premium bg-blue-500/5 text-center">
                    <p className="text-xs text-zinc-400 font-medium italic">"The universe is but a wall of bricks, waiting for your resolve."</p>
                </div>
            </div>
        </div>
    );
}
