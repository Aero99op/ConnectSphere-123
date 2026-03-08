'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

interface PresenceContextType {
    onlineUsers: Set<string>;
    isUserOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const supabase = getSupabase();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        let channel: any;

        const setupPresence = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            channel = supabase.channel('online-users', {
                config: {
                    presence: {
                        key: user.id,
                    },
                },
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    const ids = new Set(Object.keys(state));
                    setOnlineUsers(ids);
                })
                .on('presence', { event: 'join' }, ({ newPresences }: any) => {
                    if (newPresences.some((p: any) => p.user_id === user.id)) {
                        supabase
                            .from('profiles')
                            .update({ is_online: true, last_seen: new Date().toISOString() })
                            .eq('id', user.id)
                            .then();
                    }
                })
                .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
                    if (leftPresences.some((p: any) => p.user_id === user.id)) {
                        supabase
                            .from('profiles')
                            .update({ is_online: false, last_seen: new Date().toISOString() })
                            .eq('id', user.id)
                            .then();
                    }
                })
                .subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({
                            user_id: user.id,
                            online_at: new Date().toISOString(),
                        });
                    }
                });

            // Update last_seen periodically while active
            const interval = setInterval(() => {
                supabase
                    .from('profiles')
                    .update({ last_seen: new Date().toISOString(), is_online: true })
                    .eq('id', user.id)
                    .then();
            }, 1000 * 60 * 5); // Every 5 minutes

            return () => {
                clearInterval(interval);
                if (channel) supabase.removeChannel(channel);
                // Final update on unmount
                supabase
                    .from('profiles')
                    .update({ is_online: false, last_seen: new Date().toISOString() })
                    .eq('id', user.id)
                    .then();
            };
        };

        setupPresence();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const isUserOnline = (userId: string) => onlineUsers.has(userId);

    return (
        <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
            {children}
        </PresenceContext.Provider>
    );
}

export function usePresence() {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        throw new Error('usePresence must be used within a PresenceProvider');
    }
    return context;
}
