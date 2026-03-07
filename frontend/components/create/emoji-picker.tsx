"use client";

import { useState } from "react";
import { Smile, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = [
    "🔥", "❤️", "😂", "🚀", "✨", "🙌", "💯", "🎉", "⭐️", "⚡️",
    "😍", "😎", "🤩", "🤔", "🧐", "😭", "😤", "🤯", "🫠", "🥺",
    "🌈", "🍕", "🥤", "🍩", "🍦", "🍭", "🎭", "🎮", "🎸", "🎧",
    "📱", "💻", "⌚️", "📸", "📼", "💸", "💎", "💰", "🧿", "🔮"
];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    className?: string;
}

export function EmojiPicker({ onSelect, className }: EmojiPickerProps) {
    const [query, setQuery] = useState("");

    const filteredEmojis = EMOJIS.filter(emoji =>
        // Simple search logic for now
        true
    );

    return (
        <div className={cn("bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-2xl w-64", className)}>
            <div className="flex items-center gap-2 mb-4 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Search emojis..."
                    className="bg-transparent border-none text-xs text-white focus:ring-0 w-full"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto no-scrollbar">
                {EMOJIS.map((emoji, index) => (
                    <button
                        key={index}
                        onClick={() => onSelect(emoji)}
                        className="text-2xl hover:bg-white/10 p-2 rounded-xl transition-all active:scale-90"
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-center">
                <Smile className="w-3 h-3" />
                Tap to add Sticker
            </div>
        </div>
    );
}
