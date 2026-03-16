"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Ghost, HelpCircle, Skull } from "lucide-react";

const WORDS = ["CONNECT", "GAMES", "PREMIUM", "CRYPTO", "GALAXY", "PHANTOM", "CYBERPUNK", "BEYOND", "VOID", "ORBIT"];

export default function PhantomHangman() {
    const router = useRouter();
    const [word, setWord] = useState("");
    const [guessed, setGuessed] = useState<string[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');

    const initGame = () => {
        setWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
        setGuessed([]);
        setMistakes(0);
        setStatus('playing');
    };

    useEffect(() => { initGame(); }, []);

    const handleGuess = (letter: string) => {
        if (status !== 'playing' || guessed.includes(letter)) return;

        const newGuessed = [...guessed, letter];
        setGuessed(newGuessed);

        if (!word.includes(letter)) {
            const newMistakes = mistakes + 1;
            setMistakes(newMistakes);
            if (newMistakes >= 6) setStatus('lost');
        } else {
            const won = word.split('').every(l => newGuessed.includes(l));
            if (won) setStatus('won');
        }
    };

    return (
        <div className="flex w-full min-h-screen text-white relative flex-col items-center justify-center overflow-hidden bg-[#050505] md:pl-20 lg:pl-64">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111_0%,transparent_100%)] opacity-50" />
            
            <div className="z-10 w-full max-w-lg px-4 flex flex-col gap-8 py-10">
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-3 glass rounded-2xl border-premium"><ArrowLeft /></button>
                    <div className="text-center font-mono">
                        <h1 className="text-3xl font-black italic tracking-tighter text-zinc-300">PHANTOM_ID</h1>
                        <p className="text-[8px] text-zinc-500 uppercase tracking-[0.5em] mt-1 anim-pulse">Decrypting Identity...</p>
                    </div>
                    <button onClick={initGame} className="p-3 glass rounded-2xl border-premium hover:rotate-180 transition-transform"><RotateCcw /></button>
                </div>

                <div className="relative aspect-square flex flex-col items-center justify-center glass p-8 rounded-[40px] border-premium bg-zinc-900/30 overflow-hidden group">
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 70%)' }} />
                    
                    {/* Hangman Visualization (Simplified but Stylized) */}
                    <div className="relative w-48 h-64 mb-12 flex flex-col items-center justify-end gap-2">
                         <div className={`transition-all duration-700 ${mistakes >= 1 ? 'opacity-100' : 'opacity-0 scale-50'}`}>
                            <Ghost className="w-24 h-24 text-zinc-400/50 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                         </div>
                         <div className="flex gap-4">
                            <div className={`w-3 h-12 bg-white/5 rounded-full ${mistakes >= 2 ? 'bg-zinc-600' : ''}`} />
                            <div className={`w-3 h-12 bg-white/5 rounded-full ${mistakes >= 3 ? 'bg-zinc-600' : ''}`} />
                         </div>
                         <div className="flex gap-8">
                            <div className={`w-2 h-16 bg-white/5 rounded-full rotate-12 ${mistakes >= 4 ? 'bg-zinc-700' : ''}`} />
                            <div className={`w-2 h-16 bg-white/5 rounded-full -rotate-12 ${mistakes >= 5 ? 'bg-zinc-700' : ''}`} />
                         </div>
                         <div className={`absolute top-0 w-24 h-2 bg-white/10 rounded-full transition-colors ${mistakes >= 6 ? 'bg-rose-500 shadow-[0_0_20px_theme(colors.rose.500)]' : ''}`} />
                    </div>

                    <div className="flex gap-3 justify-center">
                        {word.split('').map((l, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <span className={`text-4xl font-black font-mono tracking-tighter mb-2 transition-all duration-500 ${guessed.includes(l) ? 'opacity-100 translate-y-0 scale-110' : 'opacity-0 translate-y-4'}`}>
                                    {l}
                                </span>
                                <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className={`h-full bg-white transition-all duration-700 ${guessed.includes(l) ? 'w-full' : 'w-0'}`} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {status !== 'playing' && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                             {status === 'won' ? (
                                <>
                                    <HelpCircle className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
                                    <h2 className="text-4xl font-black italic text-emerald-400 uppercase tracking-tighter">Identity Found</h2>
                                </>
                             ) : (
                                <>
                                    <Skull className="w-16 h-16 text-rose-500 mb-4 animate-pulse" />
                                    <h2 className="text-4xl font-black italic text-rose-500 uppercase tracking-tighter">Connection Offline</h2>
                                    <p className="text-xs text-zinc-500 mt-2 font-mono">The word was: {word}</p>
                                </>
                             )}
                             <button onClick={initGame} className="mt-8 px-12 py-4 glass rounded-full font-black uppercase tracking-widest hover:bg-white/10 transition-colors">Re-Attempt</button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-7 md:grid-cols-9 gap-2">
                    {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(l => (
                        <button
                            key={l}
                            onClick={() => handleGuess(l)}
                            disabled={guessed.includes(l)}
                            className={`h-10 rounded-lg flex items-center justify-center text-xs font-black transition-all
                                ${guessed.includes(l) 
                                    ? word.includes(l) ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/20 text-rose-500 border-rose-500/20 opacity-50'
                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                }
                            `}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
