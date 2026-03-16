import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";
// @ts-ignore
// import DOMPurify from "isomorphic-dompurify"; // REMOVED: Crashes Cloudflare Edge during module init

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
 * 🔱 Robust input sanitization (Fixed for Cloudflare Edge)
 * DOMPurify is only used on the client-side to prevent module initialization crashes on Edge.
 */
export function sanitizeInput(input: string): string {
    if (!input) return "";

    // If on client, use the library (it might still crash on Edge even if imported dynamically)
    // For now, using a safe server-side fallback and only real DOMPurify on browser
    if (typeof window !== 'undefined') {
        const DOMPurify = require('isomorphic-dompurify');
        return DOMPurify.sanitize(input, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span', 'ul', 'ol', 'li'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
            FORCE_BODY: true,
            ADD_ATTR: ['target'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'svg'],
            FORBID_ATTR: ['on*', 'style', 'action', 'formaction'],
        });
    }

    // Server-side (Edge) Fallback: Comprehensive HTML sanitization (CRIT-003 FIX)
    // 1. Strip ALL HTML tags completely (not just script)
    let sanitized = input.replace(/<[^>]*>/g, '');
    // 2. Encode any remaining angle brackets
    sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 3. Strip javascript: protocol patterns
    sanitized = sanitized.replace(/javascript\s*:/gi, '');
    // 4. Strip all event handler patterns (on*)
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    // 5. Strip data: URIs that could execute code
    sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, '');
    return sanitized;
}
