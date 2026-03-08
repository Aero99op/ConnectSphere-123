import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";
// @ts-ignore
import DOMPurify from "isomorphic-dompurify";

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
 * 🔱 Robust input sanitization to prevent XSS (Finding-007 FIX)
 * Uses DOMPurify to kill SVG-based XSS, Mutation XSS, and Entity encoding bypasses.
 * Replaces old regex-based logic which was bypassable.
 */
export function sanitizeInput(input: string): string {
    if (!input) return "";

    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        FORCE_BODY: true,
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'svg'],
        FORBID_ATTR: ['on*', 'style', 'action', 'formaction'],
    });
}
