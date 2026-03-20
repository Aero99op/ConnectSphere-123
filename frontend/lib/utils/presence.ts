import { format, differenceInHours } from 'date-fns';

export function formatLastSeen(date: string | Date | null): string {
    if (!date) return 'Status unknown';

    const lastSeen = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();

    const diffInHours = Math.abs(differenceInHours(now, lastSeen));

    if (diffInHours < 24) {
        // Within 24 hours - show time
        // If it's today, we can just show the time.
        return `Last seen ${format(lastSeen, 'h:mm a')}`;
    } else {
        // More than 24 hours - show date and time
        return `Last seen ${format(lastSeen, 'MMM d, h:mm a')}`;
    }
}

export function getStatusText(isOnline: boolean, lastSeen: string | Date | null, isHidden?: boolean): string {
    if (isHidden) return 'Last seen hidden';
    if (isOnline) return 'Online';
    return formatLastSeen(lastSeen);
}
