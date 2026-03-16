"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Activity } from "lucide-react";

export default function NeonPong() {
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState({ p1: 0, p2: 0 });
    const [gameOver, setGameOver] = useState(false);

    const gameState = useRef({
        p1Y: 150,
        p2Y: 150,
        ballX: 300,
        ballY: 200,
        ballDX: 3,
        ballDY: 2,
        paddleHeight: 80,
        paddleWidth: 10,
        ballSize: 8,
        canvasWidth: 600,
        canvasHeight: 400
    });

    const update = useCallback(() => {
        const state = gameState.current;
        if (gameOver) return;

        // Move ball
        state.ballX += state.ballDX;
        state.ballY += state.ballDY;

        // Wall bounce
        if (state.ballY < 0 || state.ballY > state.canvasHeight) state.ballDY *= -1;

        // Paddle collision
        if (state.ballX < state.paddleWidth + 10) {
            if (state.ballY > state.p1Y && state.ballY < state.p1Y + state.paddleHeight) {
                state.ballDX *= -1.05; // Speed up
                state.ballDY += (state.ballY - (state.p1Y + state.paddleHeight / 2)) * 0.1;
            } else if (state.ballX < 0) {
                setScore(prev => ({ ...prev, p2: prev.p2 + 1 }));
                resetBall();
            }
        }

        if (state.ballX > state.canvasWidth - state.paddleWidth - 10) {
            if (state.ballY > state.p2Y && state.ballY < state.p2Y + state.paddleHeight) {
                state.ballDX *= -1.05;
                state.ballDY += (state.ballY - (state.p2Y + state.paddleHeight / 2)) * 0.1;
            } else if (state.ballX > state.canvasWidth) {
                setScore(prev => ({ ...prev, p1: prev.p1 + 1 }));
                resetBall();
            }
        }

        // Simple CPU AI
        const cpuSpeed = 3.5;
        if (state.p2Y + state.paddleHeight / 2 < state.ballY - 10) state.p2Y += cpuSpeed;
        else if (state.p2Y + state.paddleHeight / 2 > state.ballY + 10) state.p2Y -= cpuSpeed;
        
        state.p2Y = Math.max(0, Math.min(state.canvasHeight - state.paddleHeight, state.p2Y));
    }, [gameOver]);

    const resetBall = () => {
        const state = gameState.current;
        state.ballX = state.canvasWidth / 2;
        state.ballY = state.canvasHeight / 2;
        state.ballDX = (Math.random() > 0.5 ? 1 : -1) * 3;
        state.ballDY = (Math.random() - 0.5) * 4;
    };

    const draw = useCallback((ctx: CanvasRenderingContext2D) => {
        const state = gameState.current;
        ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

        // Glow effects
        ctx.shadowBlur = 15;
        ctx.lineWidth = 2;

        // Paddles
        ctx.shadowColor = "#3b82f6";
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(10, state.p1Y, state.paddleWidth, state.paddleHeight);

        ctx.shadowColor = "#f43f5e";
        ctx.fillStyle = "#f43f5e";
        ctx.fillRect(state.canvasWidth - state.paddleWidth - 10, state.p2Y, state.paddleWidth, state.paddleHeight);

        // Ball
        ctx.shadowColor = "#fff";
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(state.ballX, state.ballY, state.ballSize, 0, Math.PI * 2);
        ctx.fill();

        // Center line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(state.canvasWidth / 2, 0);
        ctx.lineTo(state.canvasWidth / 2, state.canvasHeight);
        ctx.stroke();
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
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const y = (clientY - rect.top) * (gameState.current.canvasHeight / rect.height);
            gameState.current.p1Y = Math.max(0, Math.min(gameState.current.canvasHeight - gameState.current.paddleHeight, y - gameState.current.paddleHeight / 2));
        };

        canvas.addEventListener('mousemove', handleMove);
        canvas.addEventListener('touchmove', handleMove, { passive: false });
        
        return () => {
            cancelAnimationFrame(frameId);
            canvas.removeEventListener('mousemove', handleMove);
            canvas.removeEventListener('touchmove', handleMove);
        };
    }, [update, draw]);

    const state = gameState.current;

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#050505] md:pl-20 lg:pl-64">
            <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="z-10 w-full max-w-2xl px-4 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium hover:bg-white/10 transition-all">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="text-center">
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-blue-400 to-rose-400 bg-clip-text text-transparent">Neon Pong</h1>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-bold mt-1">Experimental Arcade</p>
                    </div>
                    <button onClick={() => setScore({ p1: 0, p2: 0 })} className="p-3 glass rounded-2xl border-premium hover:bg-white/10 transition-all">
                        <RotateCcw className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex justify-center items-center gap-12 font-black text-6xl italic tracking-tighter">
                    <span className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">{score.p1}</span>
                    <div className="w-px h-12 bg-white/10" />
                    <span className="text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]">{score.p2}</span>
                </div>

                <div className="relative glass p-1 rounded-3xl border-premium overflow-hidden shadow-2xl">
                    <canvas 
                        ref={canvasRef} 
                        width={state.canvasWidth} 
                        height={state.canvasHeight}
                        className="w-full aspect-[3/2] bg-zinc-950/50 cursor-none touch-none"
                    />
                    
                    {/* Scanline Effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] opacity-20" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl glass border-premium bg-blue-500/5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center font-bold text-blue-400">P1</div>
                        <p className="text-xs text-zinc-500 font-medium tracking-wide">Move your cursor or touch to control the paddle</p>
                    </div>
                    <div className="p-4 rounded-2xl glass border-premium bg-rose-500/5 flex items-center gap-4 text-right">
                        <p className="text-xs text-zinc-500 font-medium tracking-wide flex-1">Standard AI Protocol engaged and learning</p>
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center font-bold text-rose-400">AI</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
