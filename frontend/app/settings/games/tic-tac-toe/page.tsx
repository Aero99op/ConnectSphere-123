"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Trophy, X, Circle, Zap } from "lucide-react";

type Player = "X" | "O" | null;

export default function NeonTicTacToe() {
    const router = useRouter();
    const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true);
    const [winner, setWinner] = useState<Player | "Draw">(null);
    const [winningLine, setWinningLine] = useState<number[] | null>(null);

    const checkWinner = (squares: Player[]) => {
        const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (let [a,b,c] of lines) {
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return { w: squares[a], l: [a,b,c] };
        }
        if (squares.every(s => s)) return { w: "Draw" as const, l: null };
        return null;
    };

    const handleClick = (i: number) => {
        if (winner || board[i]) return;
        const next = [...board];
        next[i] = isXNext ? "X" : "O";
        setBoard(next);
        setIsXNext(!isXNext);
        const res = checkWinner(next);
        if (res) { setWinner(res.w); setWinningLine(res.l); }
    };

    const reset = () => { setBoard(Array(9).fill(null)); setIsXNext(true); setWinner(null); setWinningLine(null); };

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#020202] md:pl-20 lg:pl-64">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111_0%,transparent_100%)] opacity-50" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-8 py-10">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium transition-transform hover:scale-110"><ArrowLeft /></button>
                    <div className="text-center">
                        <h1 className="text-4xl font-black italic tracking-tighter bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent uppercase">Neon Tic-Tac-Toe</h1>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-[0.4em] uppercase mt-1">Grid System v1.4</p>
                    </div>
                    <button onClick={reset} className="p-3 glass rounded-2xl border-premium hover:rotate-180 transition-transform duration-500"><RotateCcw /></button>
                </div>

                <div className="flex justify-center items-center gap-12 font-black italic tracking-tighter uppercase mb-2">
                    <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${isXNext && !winner ? 'opacity-100 scale-125' : 'opacity-30'}`}>
                        <X className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                        <span className="text-[8px] tracking-[0.3em] font-bold text-cyan-500">Player_X</span>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${!isXNext && !winner ? 'opacity-100 scale-125' : 'opacity-30'}`}>
                        <Circle className="w-10 h-10 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                        <span className="text-[8px] tracking-[0.3em] font-bold text-blue-500">Player_O</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 aspect-square glass p-5 rounded-[40px] border-premium bg-zinc-900/40 relative">
                     {board.map((cell, i) => {
                        const isWin = winningLine?.includes(i);
                        return (
                            <button
                                key={i}
                                onClick={() => handleClick(i)}
                                className={`aspect-square rounded-3xl glass border-premium flex items-center justify-center transition-all duration-300
                                    ${cell ? '' : 'hover:bg-white/5 active:scale-95'}
                                    ${isWin ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.2)]' : ''}
                                `}
                            >
                                {cell === 'X' && <X className="w-1/2 h-1/2 text-cyan-400 animate-in zoom-in spin-in-12 duration-500 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />}
                                {cell === 'O' && <Circle className="w-1/2 h-1/2 text-blue-500 animate-in zoom-in duration-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />}
                            </button>
                        );
                     })}

                     {winner && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl rounded-[40px] animate-in fade-in zoom-in duration-500">
                             <Trophy className="w-16 h-16 text-cyan-500 mb-4 animate-bounce" />
                             <h2 className="text-5xl font-black italic text-white uppercase tracking-tighter italic">
                                {winner === 'Draw' ? "Parity" : `${winner} DOMINATED`}
                             </h2>
                             <button onClick={reset} className="mt-8 px-12 py-4 bg-cyan-500 text-black font-black uppercase rounded-full tracking-[0.3em] hover:scale-110 transition-transform">Reset Matrix</button>
                        </div>
                     )}
                </div>

                <div className="p-6 rounded-3xl glass border-premium bg-cyan-500/5 flex items-center gap-4">
                    <Zap className="w-6 h-6 text-cyan-500" />
                    <p className="text-xs text-zinc-500 font-medium tracking-wide">Dynamic Grid Protocol engaged. Real-time parity check active.</p>
                </div>
            </div>
        </div>
    );
}
