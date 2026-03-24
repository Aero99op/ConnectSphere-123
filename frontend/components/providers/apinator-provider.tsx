"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getApinatorClient } from '@/lib/apinator';
import { useAuth } from './auth-provider';

interface ApinatorContextType {
    client: any;
    isConnected: boolean;
}

const ApinatorContext = createContext<ApinatorContextType>({
    client: null,
    isConnected: false,
});

export const useApinator = () => useContext(ApinatorContext);

export function ApinatorProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [client, setClient] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {

        const apinatorClient = getApinatorClient();
        if (!apinatorClient) return;

        setClient(apinatorClient);

        // Force a connection attempt if not already connected
        if (apinatorClient.state !== 'connected' && apinatorClient.state !== 'connecting') {
            console.log("[ApinatorProvider] 🚀 Submitting Global Connect Request");
            apinatorClient.connect();
        } else if (apinatorClient.state === 'connected') {
            setIsConnected(true);
        }

        const handleStateChange = (states: any) => {
            if (states.current === 'connected') {
                setIsConnected(true);
            } else if (states.current === 'disconnected' || states.current === 'failed' || states.current === 'unavailable') {
                setIsConnected(false);
                // The client has auto-reconnect, but we can log metrics here
            }
        };

        apinatorClient.bind('state_change', handleStateChange);

        // We bind to visibility change purely to nudge the existing client's internal logic,
        // without blindly calling connect() everywhere in the app.
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (apinatorClient.state !== 'connected' && apinatorClient.state !== 'connecting') {
                    console.log("[ApinatorProvider] 🔄 Nudging global connection on visibility change");
                    apinatorClient.connect();
                }
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);

        // AGGRESSIVE HEARTBEAT & DEADLOCK BREAKER
        // Browsers sleep WebSockets. This wakes it up and breaks deadlocked 'connecting' states.
        let connectingTicks = 0;

        const heartbeatInterval = setInterval(() => {
            if (apinatorClient) {
                const s = apinatorClient.state;
                if (s === 'disconnected' || s === 'unavailable' || s === 'failed') {
                    console.warn(`[ApinatorProvider] 🫀 Heartbeat detected drop (state: ${s}). Reconnecting...`);
                    apinatorClient.connect();
                    connectingTicks = 0;
                } else if (s === 'connecting') {
                    connectingTicks++;
                    // Relaxed to 9 ticks (90s) to allow slower mobile connections
                    // and avoid false deadlock detection on mobile data / Edge Runtime
                    if (connectingTicks >= 9) {
                        console.warn("[ApinatorProvider] ⚠️ Connection stalled. Recycling socket...");
                        apinatorClient.disconnect();
                        setTimeout(() => apinatorClient.connect(), 500);
                        connectingTicks = 0;
                    }
                } else if (s === 'connected') {
                    connectingTicks = 0;
                }
            }
        }, 10000); // Check every 10 seconds 

        return () => {
            // In a global provider, we NEVER disconnect on unmount unless the whole app is closing.
            apinatorClient.unbind('state_change', handleStateChange);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(heartbeatInterval);
            // Deliberately omitting apinatorClient.disconnect()
        };
    }, [user]); // Re-evaluate if user changes (log in/out)

    return (
        <ApinatorContext.Provider value={{ client, isConnected }}>
            {children}
        </ApinatorContext.Provider>
    );
}
