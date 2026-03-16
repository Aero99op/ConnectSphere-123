"use client";

import { useEffect } from 'react';

export function PWAProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(
                    (registration) => console.log('SW registered: ', registration),
                    (error) => console.log('SW registration failed: ', error)
                );
            });
        }
    }, []);

    return <>{children}</>;
}
