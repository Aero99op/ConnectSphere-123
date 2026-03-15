"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Brain, Timer, Hash, Trophy } from "lucide-react";

interface Card {
    id: number;
    symbol: string;
    isFlipped: boolean;
    isMatched: boolean;
}

const SYMBOLS = ["🔥", "⭐", "🚀", "💎", "🧩", "🌈", "⚡", "🍀"];

export default function MemoryGame() {
    const router = useRouter();
    const [cards, setCards] = useState<Card[]>([]);
    const [flippedCards, setFlippedCards] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [matches, setMatches] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [time, setTime] = useState(0);
    const [isActive, setIsActive] = useState(false);

    const initGame = useCallback(() => {
        const shuffledSymbols = [...SYMBOLS, ...SYMBOLS]
            .sort(() => Math.random() - 0.5);
        
        const newCards = shuffledSymbols.map((symbol, index) => ({
            id: index,
            symbol,
            isFlipped: false,
            isMatched: false,
        }));

        setCards(newCards);
        setFlippedCards([]);
        setMoves(0);
        setMatches(0);
        setGameOver(false);
        setTime(0);
        setIsActive(false);
    }, []);

    useEffect(() => {
        initGame();
    }, [initGame]);

    useEffect(() => {
        let interval: any = null;
        if (isActive && !gameOver) {
            interval = setInterval(() => {
                setTime((time) => time + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isActive, gameOver]);

    const handleCardClick = (id: number) => {
        if (!isActive) setIsActive(true);
        if (flippedCards.length === 2 || cards[id].isFlipped || cards[id].isMatched) return;

        const newCards = [...cards];
        newCards[id].isFlipped = true;
        setCards(newCards);

        const newFlipped = [...flippedCards, id];
        setFlippedCards(newFlipped);

        if (newFlipped.length === 2) {
            setMoves(m => m + 1);
            const [firstId, secondId] = newFlipped;
            
            if (newCards[firstId].symbol === newCards[secondId].symbol) {
                newCards[firstId].isMatched = true;
                newCards[secondId].isMatched = true;
                setCards(newCards);
                setFlippedCards([]);
                setMatches(m => m + 1);
                
                if (matches + 1 === SYMBOLS.length) {
                    setGameOver(true);
                }
            } else {
                setTimeout(() => {
                    newCards[firstId].isFlipped = false;
                    newCards[secondId].isFlipped = false;
                    setCards(newCards);
                    setFlippedCards([]);
                }, 1000);
            }
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex w-full min-h-screen text-white relative pb-20 md:pl-20 lg:pl-64 justify-center overflow-hidden">
            <div className="fixed inset-0 z-0 bg-[#09090b] pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] opacity-40" />
                <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] opacity-30" />
            </div>

            <div className="w-full max-w-md py-6 md:py-10 flex flex-col gap-8 z-10 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-3xl font-display font-black tracking-tight italic bg-gradient-to-br from-white to-blue-500 bg-clip-text text-transparent uppercase">Memory</h1>
                    </div>
                    <button
                        onClick={initGame}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                    >
                        <RotateCcw className="w-6 h-6 group-active:rotate-180 transition-transform duration-500" />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-2xl glass border-premium flex flex-col items-center">
                        <Timer className="w-4 h-4 text-zinc-500 mb-1" />
                        <span className="text-xl font-bold">{formatTime(time)}</span>
                    </div>
                    <div className="p-3 rounded-2xl glass border-premium flex flex-col items-center">
                        <Brain className="w-4 h-4 text-zinc-500 mb-1" />
                        <span className="text-xl font-bold">{moves}</span>
                    </div>
                    <div className="p-3 rounded-2xl glass border-premium flex flex-col items-center">
                        <Hash className="w-4 h-4 text-zinc-500 mb-1" />
                        <span className="text-xl font-bold">{matches}/{SYMBOLS.length}</span>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3 bg-zinc-900/50 backdrop-blur-xl p-4 rounded-[2rem] border border-white/5">
                    {cards.map((card) => (
                        <button
                            key={card.id}
                            onClick={() => handleCardClick(card.id)}
                            className={`aspect-square relative perspective-1000 group transition-all duration-500 ${card.isMatched ? 'opacity-50 scale-95' : ''}`}
                        >
                            <div className={`relative w-full h-full text-center transition-transform duration-500 preserve-3d ${card.isFlipped ? 'rotate-y-180' : ''}`}>
                                {/* Front */}
                                <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl backface-hidden flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                    <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                                </div>
                                {/* Back */}
                                <div className="absolute inset-0 bg-blue-500/20 border border-blue-500/30 rounded-xl rotate-y-180 backface-hidden flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                                    {card.symbol}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {gameOver && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-500">
                        <div className="w-full max-w-xs glass border-premium rounded-[2.5rem] p-8 text-center flex flex-col gap-4">
                            <div className="w-20 h-20 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-2">
                                <Trophy className="w-10 h-10 text-blue-400" />
                            </div>
                            <h2 className="text-3xl font-black italic">Brilliant!</h2>
                            <p className="text-zinc-500 text-sm">
                                You found all pairs in <span className="text-white font-bold">{moves} moves</span> and <span className="text-white font-bold">{formatTime(time)}</span>.
                            </p>
                            <button
                                onClick={initGame}
                                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold hover:scale-105 transition-transform active:scale-95 shadow-[0_10px_20px_rgba(37,99,235,0.3)]"
                            >
                                Play Again
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
}
