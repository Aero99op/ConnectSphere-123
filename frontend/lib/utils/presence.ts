import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export function formatLastSeen(date: string | Date | null): string {
    if (!date) return 'Offline';

    const lastSeen = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
        // Within 24 hours - show time
        return `Last seen ${format(lastSeen, 'h:mm a')}`;
    } else {
        // More than 24 hours - show date and time
        return `Last seen ${format(lastSeen, 'MMM d, h:mm a')}`;
    }
}

export function getStatusText(isOnline: boolean, lastSeen: string | Date | null): string {
    if (isOnline) return 'Online';
    return formatLastSeen(lastSeen);
}
