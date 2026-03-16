import Dexie, { type Table } from 'dexie';

export interface OfflinePost {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    caption?: string;
    media_urls: string[];
    thumbnail_url?: string;
    media_type: string;
    likes_count: number;
    created_at: string;
    profiles?: any;
}

export interface OfflineStory {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    media_urls: string[];
    thumbnail_url?: string;
    media_type: string;
    expires_at: string;
    created_at: string;
}

export interface PendingAction {
    id?: number;
    type: 'like' | 'comment';
    targetId: string;
    data: any;
    timestamp: number;
}

export class ConnectDB extends Dexie {
    posts!: Table<OfflinePost>;
    stories!: Table<OfflineStory>;
    pendingActions!: Table<PendingAction>;
    profile!: Table<{ id: string; data: any }>;

    constructor() {
        super('ConnectOfflineDB');
        this.version(1).stores({
            posts: 'id, created_at, user_id',
            stories: 'id, expires_at, user_id',
            pendingActions: '++id, type, targetId',
            profile: 'id'
        });
    }
}

export const db = new ConnectDB();
