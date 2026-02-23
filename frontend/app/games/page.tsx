"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { RefreshCcw, Loader2 } from "lucide-react";

function GamesPageContent() {
    const [board, setBoard] = useState(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true);

    const checkWinner = (squares: any[]) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6],
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        return null;
    };

    const winner = checkWinner(board);

    const handleClick = (i: number) => {
        if (board[i] || winner) return;
        const newBoard = [...board];
        newBoard[i] = isXNext ? "X" : "O";
        setBoard(newBoard);
        setIsXNext(!isXNext);
    };

    const resetGame = () => {
        setBoard(Array(9).fill(null));
        setIsXNext(true);
    };

    return (
        <div className="min-h-screen bg-background pb-20 p-4 flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                Community Games 🎮
            </h1>

            <div className="w-full max-w-xs aspect-square grid grid-cols-3 gap-2 bg-white/10 p-2 rounded-xl">
                {board.map((cell, i) => (
                    <button
                        key={i}
                        onClick={() => handleClick(i)}
                        className="w-full h-full bg-black/40 rounded-lg text-4xl font-bold text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                    >
                        {cell}
                    </button>
                ))}
            </div>

            <div className="mt-8 text-center">
                {winner ? (
                    <h2 className="text-2xl font-bold text-green-400">Winner: {winner} 🎉</h2>
                ) : (
                    <p className="text-gray-400">Next Player: {isXNext ? 'X' : 'O'}</p>
                )}

                <button
                    onClick={resetGame}
                    className="mt-6 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors"
                >
                    <RefreshCcw className="w-4 h-4" /> Reset Game
                </button>
            </div>
        </div>
    );
}

export default function GamesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>}>
            <GamesPageContent />
        </Suspense>
    );
}
