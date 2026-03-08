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

                    if (ids.has(user.id)) {
                        supabase
                            .from('profiles')
                            .update({ is_online: true, last_seen: new Date().toISOString() })
                            .eq('id', user.id)
                            .then();
                    }
                })
                .on('presence', { event: 'join' }, ({ key }: any) => {
                    if (key === user.id) {
                        supabase
                            .from('profiles')
                            .update({ is_online: true, last_seen: new Date().toISOString() })
                            .eq('id', user.id)
                            .then();
                    }
                })
                .on('presence', { event: 'leave' }, ({ key }: any) => {
                    if (key === user.id) {
                        const state = channel.presenceState();
                        if (!state[user.id] || state[user.id].length === 0) {
                            supabase
                                .from('profiles')
                                .update({ is_online: false, last_seen: new Date().toISOString() })
                                .eq('id', user.id)
                                .then();
                        }
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

            // Update last_seen periodically while active (every 2 minutes for better precision)
            const interval = setInterval(() => {
                supabase
                    .from('profiles')
                    .update({ last_seen: new Date().toISOString(), is_online: true })
                    .eq('id', user.id)
                    .then();
            }, 1000 * 60 * 2);

            return () => {
                clearInterval(interval);
                // Final update on unmount: only if no other tabs are open
                const state = channel?.presenceState();
                if (!state || !state[user.id] || state[user.id].length <= 1) {
                    supabase
                        .from('profiles')
                        .update({ is_online: false, last_seen: new Date().toISOString() })
                        .eq('id', user.id)
                        .then();
                }
                if (channel) supabase.removeChannel(channel);
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
