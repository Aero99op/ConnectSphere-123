import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatTimeAgo(date: Date | string | number): string {
    if (!date) return "";
    try {
        const d = new Date(date);
        return formatDistanceToNowStrict(d, { addSuffix: true });
    } catch (e) {
        return "";
    }
}

/**
 * Lightweight input sanitization to prevent basic XSS
 * Strips common dangerous tags like <script>, <iframe>, <object>, etc.
 */
export function sanitizeInput(input: string): string {
    if (!input) return "";
    // Regex to strip tags like <script>...</script>, <img ...>, etc.
    // We target common XSS vectors while allowing plain text.
    return input
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
        .replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "")
        .replace(/<embed\b[^>]*>([\s\S]*?)<\/embed>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        // Strip event handlers like onclick, onerror, onload, etc. more robustly
        .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gim, "")
        .replace(/javascript:[^"']*/gim, ""); // Strip javascript: protocol
}
