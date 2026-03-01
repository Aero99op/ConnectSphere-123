"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Settings, LogOut, MessageCircle, MapPin, Camera, Compass } from "lucide-react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ProfilePageContent() {
    const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'reports'>('posts');
    const [profile, setProfile] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [savedPosts, setSavedPosts] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);

        // Get Current User
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        if (!user) {
            // Guest View or Logged Out
            setProfile({
                full_name: "Guest User",
                username: "guest",
                bio: "Browsing anonymously. Sign in to save your profile!",
                avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
                karma_points: 0
            });
            setLoading(false);
            return;
        }
        try {
            // Fetch Profile Data
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            setProfile(profileData || { full_name: "User Not Found", username: "unknown" });

            // Fetch User Posts
            const { data: postsData } = await supabase
                .from("posts")
                .select("*, profiles(*)")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            // Format posts
            const formattedPosts = postsData?.map((post: any) => ({
                ...post,
                username: post.profiles?.username || "Me",
                avatar_url: post.profiles?.avatar_url
            })) || [];
            setPosts(formattedPosts);

            // Fetch Saved Posts (Bookmarks)
            const { data: bookmarksData } = await supabase
                .from("bookmarks")
                .select(`
                id,
                posts (
                    *,
                    profiles (*)
                )
            `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            const formattedSavedPosts = bookmarksData?.map((item: any) => ({
                ...item.posts,
                username: item.posts?.profiles?.username || "Unknown",
                avatar_url: item.posts?.profiles?.avatar_url
            })) || [];

            setSavedPosts(formattedSavedPosts.filter((p: any) => p.id));

            // Fetch User Reports with History
            const { data: reportsData } = await supabase
                .from("reports")
                .select(`
                *,
                report_updates (
                    id,
                    new_status,
                    description,
                    media_urls,
                    latitude,
                    longitude,
                    created_at,
                    official_id,
                    profiles:official_id (full_name, avatar_url)
                )
            `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            setReports(reportsData || []);
        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveAllBookmarks = async () => {
        if (!confirm("Are you sure you want to remove ALL your bookmarks?")) return;

        const { error } = await supabase.rpc('clear_all_bookmarks');

        if (error) {
            console.error(error);
            alert("Error clearing bookmarks");
        } else {
            setSavedPosts([]);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/role-selection';
    };

    const handleMessage = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !profile) return;

        if (user.id === profile.id) return;

        // Check if conversation exists (checking both combinations)
        const { data: existing, error } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${user.id})`)
            .single();

        if (existing) {
            toast.success(`Chat is open! Check your messages.`);
        } else {
            // Create new conversation
            const { error: createError } = await supabase
                .from('conversations')
                .insert({ user1_id: user.id, user2_id: profile.id });

            if (createError) {
                console.error(createError);
                toast.error("Chat start nahi ho payi.");
            } else {
                toast.success(`Conversation started! Check your list.`);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#050507] gap-6">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin shadow-[0_0_30px_rgba(255,165,0,0.1)]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Camera className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                </div>
                <p className="text-primary/60 font-display font-black text-xs uppercase tracking-[0.4em] animate-pulse">Syncing Persona...</p>
            </div>
        );
    }

    return (
        <div className="pb-32 min-h-screen bg-[#050507] text-white selection:bg-primary/30">
            {/* Header / Cover - Ambient Glow */}
            <div className="h-48 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,165,0,0.15),transparent_70%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-10" />

                <button
                    onClick={handleLogout}
                    className="absolute top-6 right-6 p-2.5 glass border-premium rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-90 shadow-premium-sm"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Profile Info Card */}
            <div className="px-6 relative -mt-20 mb-8">
                <div className="glass-card p-6 rounded-[2.5rem] border-premium shadow-premium-lg">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-tr from-primary via-secondary to-primary blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-700 rounded-[2rem]" />
                                <Avatar className="w-32 h-32 border-[6px] border-[#050507] rounded-[1.8rem] shadow-2xl relative z-10 ring-1 ring-white/10">
                                    <AvatarImage src={profile?.avatar_url} className="object-cover" />
                                    <AvatarFallback className="bg-zinc-900 text-3xl font-display font-black text-primary">
                                        {profile?.full_name?.[0] || "?"}
                                    </AvatarFallback>
                                </Avatar>
                            </div>

                            <div className="text-center md:text-left flex-1 min-w-0">
                                <h1 className="text-3xl font-display font-black tracking-tightest text-gradient">
                                    {profile?.full_name || "New Entity"}
                                </h1>
                                <p className="text-sm font-mono text-primary/60 uppercase tracking-widest mt-1">
                                    @{profile?.username || "identity_unknown"}
                                </p>
                                <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-md font-medium tracking-tight">
                                    {profile?.bio || "No bio transmitted yet."}
                                </p>
                            </div>
                        </div>

                        {/* Tactical Stats */}
                        <div className="flex gap-4 p-4 glass rounded-3xl border-premium bg-black/40">
                            {[
                                { label: 'Posts', val: posts.length },
                                { label: 'Reports', val: reports.length },
                                { label: 'Karma', val: profile?.karma_points || 0 }
                            ].map((stat) => (
                                <div key={stat.label} className="text-center px-4 border-r border-white/5 last:border-0">
                                    <p className="font-display font-black text-xl tracking-tighter text-white">{stat.val}</p>
                                    <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-zinc-500 mt-0.5">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    {profile?.id !== currentUserId && (
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleMessage}
                                className="flex-1 bg-white text-black font-display font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl text-xs uppercase tracking-widest"
                            >
                                <MessageCircle className="w-4 h-4" /> Message
                            </button>
                            <button className="flex-1 glass border-premium font-display font-black py-4 rounded-2xl hover:bg-white/5 transition-all active:scale-95 text-xs uppercase tracking-widest">
                                Connect
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs - Dock Style */}
            <div className="px-6 mb-8 sticky top-4 z-40">
                <div className="glass-panel p-1.5 rounded-[2rem] border-premium shadow-premium-md flex gap-2">
                    {[
                        { id: 'posts', label: 'Posts', icon: Camera },
                        { id: 'saved', label: 'Saved', icon: Settings },
                        { id: 'reports', label: 'Reports', icon: Compass }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex-1 py-3 px-4 rounded-2xl text-[11px] font-display font-black uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2",
                                activeTab === tab.id
                                    ? "bg-primary text-black shadow-[0_0_20px_rgba(255,165,0,0.3)] ring-1 ring-white/20"
                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                            )}
                        >
                            {/* <tab.icon className="w-4 h-4" /> */}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="px-6 space-y-8">
                {activeTab === 'posts' ? (
                    <div className="space-y-6">
                        {posts.map(post => (
                            <PostCard key={post.id} post={post} />
                        ))}
                        {posts.length === 0 && (
                            <div className="text-center py-10 opacity-50">
                                No posts yet. Start uploading!
                            </div>
                        )}
                    </div>
                ) : activeTab === 'saved' ? (
                    <div className="space-y-6">
                        {savedPosts.length > 0 && (
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={handleRemoveAllBookmarks}
                                    className="text-xs text-red-500 hover:text-red-400 border border-red-500/50 px-3 py-1 rounded-full transition-colors"
                                >
                                    Remove All Bookmarks
                                </button>
                            </div>
                        )}
                        {savedPosts.map(post => (
                            <PostCard key={post.id} post={post} />
                        ))}
                        {savedPosts.length === 0 && (
                            <div className="text-center py-10 opacity-50 flex flex-col items-center gap-2">
                                <span className="text-4xl">🎒</span>
                                <p>Bookmarks are empty!</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reports.map((report) => (
                            <div key={report.id} className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="p-4 flex gap-4">
                                    {/* Preview Image or Icon */}
                                    <div className="w-16 h-16 bg-zinc-800 rounded-lg flex-shrink-0 overflow-hidden">
                                        {report.media_urls?.[0] ? (
                                            <img src={report.media_urls[0]} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-2xl">⚠️</div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white truncate">{report.title}</h3>
                                        <p className="text-xs text-zinc-400 truncate">{report.address}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${report.status === 'completed' ? 'bg-green-500/10 border-green-500 text-green-500' :
                                                report.status === 'working' ? 'bg-orange-500/10 border-orange-500 text-orange-500' :
                                                    'bg-red-500/10 border-red-500 text-red-500'
                                                }`}>
                                                {report.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-[10px] text-zinc-600">
                                                {new Date(report.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline / Work History */}
                                {report.report_updates && report.report_updates.length > 0 && (
                                    <div className="px-4 pb-4 pt-2 bg-white/5 border-t border-white/5">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Work History 🛠️</p>
                                        <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10">
                                            {report.report_updates.map((update: any) => (
                                                <div key={update.id} className="relative pl-7">
                                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center z-10">
                                                        <div className={`w-2 h-2 rounded-full ${update.new_status === 'completed' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-blue-500'}`} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-zinc-200">
                                                            {update.description}
                                                        </p>

                                                        {update.media_urls?.[0] && (
                                                            <div className="mt-2 rounded-xl overflow-hidden border border-white/5 max-w-[200px]">
                                                                <img src={update.media_urls[0]} className="w-full h-24 object-cover" />
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between mt-1">
                                                            <p className="text-[10px] text-zinc-500">
                                                                By Official: {update.profiles?.full_name || "Assigned Official"} • {new Date(update.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                            {update.latitude && (
                                                                <div className="flex items-center gap-0.5 text-[8px] text-green-500 font-bold bg-green-500/10 px-1 rounded">
                                                                    <Compass className="w-2 h-2" /> GEOPROOF
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {reports.length === 0 && (
                            <div className="text-center py-10 opacity-50 flex flex-col items-center gap-2">
                                <span className="text-4xl">🤷‍♂️</span>
                                <p>No reports submitted yet.</p>
                                <button className="text-primary text-sm underline" onClick={() => router.push('/report')}>Submit an Issue</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white"><Loader2 className="animate-spin" /></div>}>
            <ProfilePageContent />
        </Suspense>
    );
}
