"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Trophy, Timer, Apple } from "lucide-react";

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;

interface Point {
    x: number;
    y: number;
}

export default function SnakeGame() {
    const router = useRouter();
    const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
    const [food, setFood] = useState<Point>({ x: 5, y: 5 });
    const [direction, setDirection] = useState<Point>({ x: 0, y: -1 });
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [speed, setSpeed] = useState(INITIAL_SPEED);
    
    const gameLoopRef = useRef<NodeJS.Timeout>();
    const lastDirectionRef = useRef<Point>({ x: 0, y: -1 });

    const generateFood = useCallback((currentSnake: Point[]) => {
        let newFood;
        while (true) {
            newFood = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };
            const onSnake = currentSnake.some(segment => segment.x === newFood!.x && segment.y === newFood!.y);
            if (!onSnake) break;
        }
        return newFood;
    }, []);

    const resetGame = () => {
        setSnake([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
        setDirection({ x: 0, y: -1 });
        lastDirectionRef.current = { x: 0, y: -1 };
        setScore(0);
        setGameOver(false);
        setSpeed(INITIAL_SPEED);
        setFood(generateFood([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]));
    };

    const moveSnake = useCallback(() => {
        if (gameOver) return;

        setSnake(prevSnake => {
            const head = prevSnake[0];
            const newHead = {
                x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
                y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE
            };

            // Check collision with self
            if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
                setGameOver(true);
                return prevSnake;
            }

            const newSnake = [newHead, ...prevSnake];

            // Check food collision
            if (newHead.x === food.x && newHead.y === food.y) {
                setScore(s => s + 10);
                setFood(generateFood(newSnake));
                if (speed > 60) setSpeed(s => s - 2);
            } else {
                newSnake.pop();
            }

            lastDirectionRef.current = direction;
            return newSnake;
        });
    }, [direction, food, gameOver, generateFood, speed]);

    useEffect(() => {
        gameLoopRef.current = setInterval(moveSnake, speed);
        return () => clearInterval(gameLoopRef.current);
    }, [moveSnake, speed]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const keys: Record<string, Point> = {
                ArrowUp: { x: 0, y: -1 },
                ArrowDown: { x: 0, y: 1 },
                ArrowLeft: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 }
            };

            const newDir = keys[e.key];
            if (newDir) {
                // Prevent 180 degree turns
                if (newDir.x !== -lastDirectionRef.current.x || newDir.y !== -lastDirectionRef.current.y) {
                    setDirection(newDir);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 md:pl-20 lg:pl-64 justify-center overflow-hidden">
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-green-500/10 rounded-full blur-[100px] opacity-40" />
            </div>

            <div className="w-full max-w-md py-6 md:py-10 flex flex-col gap-6 z-10 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-3xl font-display font-black tracking-tight italic bg-gradient-to-br from-white to-green-500 bg-clip-text text-transparent uppercase">Snake</h1>
                    </div>
                    <button onClick={resetGame} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <RotateCcw className="w-6 h-6" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-2xl glass border-premium flex flex-col items-center">
                        <Apple className="w-4 h-4 text-green-500 mb-1" />
                        <span className="text-xl font-bold">{score}</span>
                    </div>
                    <div className="p-3 rounded-2xl glass border-premium flex flex-col items-center">
                        <Timer className="w-4 h-4 text-zinc-500 mb-1" />
                        <span className="text-xl font-bold">{Math.floor(1000/speed)} fps</span>
                    </div>
                </div>

                <div className="relative mx-auto bg-zinc-900/80 backdrop-blur-xl p-1 rounded-2xl border-4 border-white/5 shadow-2xl overflow-hidden" style={{ width: '320px', height: '320px' }}>
                    <div className="grid grid-cols-20 grid-rows-20 w-full h-full gap-px bg-white/5">
                        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                            const x = i % GRID_SIZE;
                            const y = Math.floor(i / GRID_SIZE);
                            const isSnakeHead = snake[0].x === x && snake[0].y === y;
                            const isSnakeBody = snake.slice(1).some(s => s.x === x && s.y === y);
                            const isFood = food.x === x && food.y === y;

                            return (
                                <div key={i} className={`w-full h-full rounded-sm transition-colors duration-200 
                                    ${isSnakeHead ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] z-10' : 
                                      isSnakeBody ? 'bg-green-600/60' : 
                                      isFood ? 'bg-red-500 animate-pulse' : 'bg-black/20'}`}>
                                </div>
                            );
                        })}
                    </div>

                    {gameOver && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                            <h2 className="text-3xl font-black mb-4 flex items-center gap-2">Game Over! 💀</h2>
                            <p className="text-zinc-400 mb-6">Final Score: <span className="text-white font-bold">{score}</span></p>
                            <button onClick={resetGame} className="px-8 py-3 rounded-2xl bg-green-600 text-white font-bold hover:scale-105 transition-transform">
                                Try Again
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile Controls */}
                <div className="md:hidden grid grid-cols-3 gap-2 max-w-[180px] mx-auto mt-4">
                    <div />
                    <button onClick={() => direction.y === 0 && setDirection({ x: 0, y: -1 })} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="rotate-90" /></button>
                    <div />
                    <button onClick={() => direction.x === 0 && setDirection({ x: -1, y: 0 })} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft /></button>
                    <button onClick={() => direction.y === 0 && setDirection({ x: 0, y: 1 })} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="-rotate-90" /></button>
                    <button onClick={() => direction.x === 0 && setDirection({ x: 1, y: 0 })} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="rotate-180" /></button>
                </div>

                <p className="hidden md:block text-zinc-500 text-center text-xs">
                    Use <span className="text-white font-bold">Arrow Keys</span> to control the snake.
                </p>
            </div>
        </div>
    );
}
