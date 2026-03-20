'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './auth-provider';
import { useApinator } from './apinator-provider';

interface PresenceContextType {
    onlineUsers: Set<string>;
    isUserOnline: (userId: string) => boolean;
    isGhostModeActive: boolean;
    isHiddenStatusActive: boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const { user, supabase } = useAuth();
    const { client } = useApinator();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [isGhostModeActive, setIsGhostModeActive] = useState(false);
    const [isHiddenStatusActive, setIsHiddenStatusActive] = useState(false);
    
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const ghostTimerRef = useRef<NodeJS.Timeout | null>(null);
    const ghostRef = useRef(false);
    const hiddenRef = useRef(false);

    useEffect(() => {
        if (!user || !supabase) {
            setOnlineUsers(new Set());
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        let isMounted = true;
        let channel: any = null;

        const broadcastStatus = async (isOnline: boolean) => {
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: 'public-presence',
                    event: 'user-status',
                    data: { id: user.id, online: isOnline }
                })
            }).catch(console.error);
        };

        const setupPresence = async () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);

            // Fetch privacy settings (REST call, 0 WebSockets)
            const { data: profile } = await supabase
                .from('profiles')
                .select('hide_online_status, ghost_mode_until')
                .eq('id', user.id)
                .single();

            const hideStatus = profile?.hide_online_status || false;
            let ghostActive = false;
            let ghostExpiryTime = 0;

            if (profile?.ghost_mode_until) {
                const expiry = new Date(profile.ghost_mode_until).getTime();
                if (expiry > Date.now()) {
                    ghostActive = true;
                    ghostExpiryTime = expiry;
                } else if (expiry <= Date.now() && profile.ghost_mode_until !== null) {
                    supabase.from('profiles').update({ ghost_mode_until: null }).eq('id', user.id).then();
                }
            }

            if (!isMounted) return;
            
            setIsHiddenStatusActive(hideStatus);
            hiddenRef.current = hideStatus;
            
            setIsGhostModeActive(ghostActive);
            ghostRef.current = ghostActive;

            const isEffectivelyHidden = hideStatus || ghostActive;

            if (isEffectivelyHidden) {
                // User is hidden, set offline in DB and DO NOT broadcast presence
                supabase.from('profiles').update({ is_online: false }).eq('id', user.id).then();
                broadcastStatus(false);

                // If ghost mode, set a local timer to auto-resume presence when it expires
                if (ghostActive) {
                    const timeWindow = ghostExpiryTime - Date.now();
                    ghostTimerRef.current = setTimeout(() => {
                        setupPresence(); // Re-run setup to re-evaluate
                    }, timeWindow);
                }
            } else {
                // Set DB Online and Broadcast Presence to all connected clients immediately
                supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id).then();
                broadcastStatus(true);
            }

            // Apinator Connection (Re-using Chat WebSocket -> 0 Supabase Connections)
            if (client && !channel) {
                channel = client.subscribe('public-presence');
                channel.bind('user-status', (data: any) => {
                    const payload = typeof data === 'string' ? JSON.parse(data) : data;
                    if (payload.id === user.id) return; // ignore self
                    
                    setOnlineUsers(prev => {
                        const next = new Set(prev);
                        if (payload.online) next.add(payload.id);
                        else next.delete(payload.id);
                        return next;
                    });
                });
            }

            // Initial Fetch of all online users (REST only once)
            const { data: onlineProfiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('is_online', true)
                .eq('hide_online_status', false);
                
            if (onlineProfiles && isMounted) {
                const ids = new Set(onlineProfiles.map(p => p.id));
                setOnlineUsers(ids);
            }

            // Heartbeat & DB Sync (Every 60s via REST, 0 WebSockets)
            // Periodically check local profile changes to update Ghost Mode on the fly 
            intervalRef.current = setInterval(async () => {
                const { data: p } = await supabase.from('profiles').select('hide_online_status, ghost_mode_until').eq('id', user.id).single();
                const hidden = p?.hide_online_status || false;
                let ghost = false;
                if (p?.ghost_mode_until && new Date(p.ghost_mode_until).getTime() > Date.now()) {
                    ghost = true;
                }
                
                setIsHiddenStatusActive(hidden);
                hiddenRef.current = hidden;
                setIsGhostModeActive(ghost);
                ghostRef.current = ghost;

                if (!hidden && !ghost) {
                    // Update Last Seen Heartbeat
                    supabase.from('profiles').update({ last_seen: new Date().toISOString(), is_online: true }).eq('id', user.id).then();
                } else {
                    supabase.from('profiles').update({ is_online: false }).eq('id', user.id).then();
                }
            }, 60000);
        };

        setupPresence();

        // Tie into browser visibility to go offline when minimizing the app
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden' && !ghostRef.current && !hiddenRef.current) {
                supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', user.id).then();
                broadcastStatus(false);
            } else if (document.visibilityState === 'visible' && !ghostRef.current && !hiddenRef.current) {
                supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id).then();
                broadcastStatus(true);
            }
        };

        window.addEventListener('visibilitychange', handleVisibility);

        return () => {
            isMounted = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
            window.removeEventListener('visibilitychange', handleVisibility);
            
            if (!ghostRef.current && !hiddenRef.current) {
                supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', user.id).then();
                broadcastStatus(false);
            }
            if (client && channel) {
                // Ensure we don't leak subscriptions since this is a global context
                channel.unbind_all();
                client.unsubscribe('public-presence');
            }
        };
    }, [user, supabase, client]); 

    const isUserOnline = (userId: string) => onlineUsers.has(userId);

    return (
        <PresenceContext.Provider value={{ onlineUsers, isUserOnline, isGhostModeActive, isHiddenStatusActive }}>
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
