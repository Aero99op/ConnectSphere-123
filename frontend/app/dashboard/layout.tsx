import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createServerComponentClient({ cookies });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    // 1. Session check - this should ideally be caught by middleware first
    if (!session) {
        redirect('/login');
    }

    // 2. Fetch the user's role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    // 3. Strict Server-Side Role Check (Juggad security lock)
    if (!profile || profile.role !== 'official') {
        // Kick unauthorized citizens out of the command center
        redirect('/?mode=feed');
    }

    // Official cleared for entry
    return (
        <div className="min-h-screen bg-[#020617]">
            {children}
        </div>
    );
}
