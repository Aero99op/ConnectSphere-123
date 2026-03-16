"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Keyboard, CheckCircle2, AlertCircle } from "lucide-react";

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;
const SECRET_WORD = "CLOUD"; // In a real app, this would be random

export default function WordGuess() {
    const router = useRouter();
    const [guesses, setGuesses] = useState<string[]>([]);
    const [currentGuess, setCurrentGuess] = useState("");
    const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');

    const onKeyPress = (key: string) => {
        if (status !== 'playing') return;
        if (key === 'ENTER') {
            if (currentGuess.length === WORD_LENGTH) {
                const nextGuesses = [...guesses, currentGuess];
                setGuesses(nextGuesses);
                setCurrentGuess("");
                if (currentGuess === SECRET_WORD) setStatus('won');
                else if (nextGuesses.length === MAX_ATTEMPTS) setStatus('lost');
            }
        } else if (key === 'BACKSPACE') {
            setCurrentGuess(prev => prev.slice(0, -1));
        } else if (currentGuess.length < WORD_LENGTH) {
            setCurrentGuess(prev => (prev + key).toUpperCase());
        }
    };

    const getLetterStyle = (guess: string, index: number) => {
        const char = guess[index];
        if (char === SECRET_WORD[index]) return "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]";
        if (SECRET_WORD.includes(char)) return "bg-amber-500 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]";
        return "bg-zinc-800 border-zinc-700 text-zinc-400";
    };

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#0a0a0b] md:pl-20 lg:pl-64 py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111_0%,transparent_100%)] opacity-50" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium transition-transform hover:scale-110"><ArrowLeft /></button>
                    <div className="text-center font-display">
                        <h1 className="text-3xl font-black italic tracking-tighter bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent uppercase">Word Guess</h1>
                        <p className="text-[10px] text-zinc-500 tracking-[0.5em] font-bold uppercase mt-1">Linguistic Matrix</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="p-3 glass rounded-2xl border-premium hover:rotate-180 transition-transform duration-500"><RotateCcw /></button>
                </div>

                <div className="flex flex-col gap-2">
                    {[...Array(MAX_ATTEMPTS)].map((_, i) => {
                        const guess = guesses[i] || (i === guesses.length ? currentGuess : "");
                        return (
                            <div key={i} className="flex gap-2 justify-center">
                                {[...Array(WORD_LENGTH)].map((_, j) => (
                                    <div 
                                        key={j} 
                                        className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all duration-500
                                            ${guesses[i] ? getLetterStyle(guesses[i], j) : guess[j] ? 'border-zinc-500 bg-white/5' : 'border-zinc-800 bg-black/20'}
                                            ${i === guesses.length && guess[j] ? 'scale-110' : ''}
                                        `}
                                    >
                                        {guess[j] || ""}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {status !== 'playing' && (
                    <div className="p-6 rounded-3xl glass border-premium bg-zinc-900/50 flex flex-col items-center animate-in fade-in zoom-in">
                        {status === 'won' ? (
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4 animate-bounce" />
                        ) : (
                            <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-shake" />
                        )}
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                            {status === 'won' ? "Decrypted" : "Node Locked"}
                        </h2>
                        <p className="text-zinc-500 mt-2 font-mono">Real Word: {SECRET_WORD}</p>
                        <button onClick={() => window.location.reload()} className="mt-6 px-12 py-3 bg-white text-black font-black uppercase rounded-full tracking-widest hover:scale-105 transition-transform">Reset</button>
                    </div>
                )}

                <div className="grid grid-cols-10 gap-1 mt-4">
                    {Array.from("QWERTYUIOPASDFGHJKLZXCVBNM").map(key => (
                        <button
                            key={key}
                            onClick={() => onKeyPress(key)}
                            className="h-10 md:h-12 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] md:text-xs font-black hover:bg-zinc-800 transition-colors active:scale-95"
                        >
                            {key}
                        </button>
                    ))}
                    <button onClick={() => onKeyPress('BACKSPACE')} className="col-span-2 h-10 md:h-12 rounded-lg bg-rose-500/20 text-rose-500 border border-rose-500/20 text-[10px] uppercase font-black">Del</button>
                    <button onClick={() => onKeyPress('ENTER')} className="col-span-3 h-10 md:h-12 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-[10px] uppercase font-black">Enter</button>
                </div>
            </div>
        </div>
    );
}
