"use client";

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

function AuthCallbackPageContent() {
    const router = useRouter();

    useEffect(() => {
        // Supabase automatically handles the hash fragment token
        // We just need to wait for the session to be established
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                router.push('/');
            }
        });
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p>Verifying magic...</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-white"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
            <AuthCallbackPageContent />
        </Suspense>
    );
}
