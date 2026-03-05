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
