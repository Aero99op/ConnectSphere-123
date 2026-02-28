"use client";

import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MessageCircle } from "lucide-react";

interface CommentSheetProps {
    postId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CommentSheet({ postId, open, onOpenChange }: CommentSheetProps) {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchComments();
        }
    }, [open]);

    const fetchComments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("comments")
            .select(`
        *,
        profiles (username, avatar_url)
      `)
            .eq("post_id", postId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching comments:", error);
        } else {
            const formatted = data?.map(c => ({
                ...c,
                username: c.profiles?.username || "Anonymous",
                avatar_url: c.profiles?.avatar_url
            })) || [];
            setComments(formatted);
        }
        setLoading(false);
    };

    const handleSend = async () => {
        if (!newComment.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert("Login toh karlo!");

        const { error } = await supabase.from("comments").insert({
            post_id: postId,
            user_id: user.id,
            content: newComment
        });

        if (error) {
            alert("Comment fail ho gaya!");
        } else {
            // Trigger Notification
            const { data: postData } = await supabase
                .from('posts')
                .select('user_id')
                .eq('id', postId)
                .single();

            if (postData && postData.user_id !== user.id) {
                await supabase.from('notifications').insert({
                    recipient_id: postData.user_id,
                    actor_id: user.id,
                    type: 'comment',
                    entity_id: postId
                });
            }

            setNewComment("");
            fetchComments(); // Refresh
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerTrigger asChild>
                <button className="text-foreground hover:text-primary transition-colors">
                    <MessageCircle className="w-6 h-6" />
                </button>
            </DrawerTrigger>
            <DrawerContent className="h-[70vh] bg-black border-t border-white/10">
                <DrawerHeader>
                    <DrawerTitle className="text-white text-center">Baatcheet ({comments.length})</DrawerTitle>
                </DrawerHeader>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                    ) : comments.length === 0 ? (
                        <p className="text-center text-gray-500 text-sm">No comments yet. Be the first!</p>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3 relative group">
                                <Avatar className="w-8 h-8">
                                    <AvatarImage src={comment.avatar_url} />
                                    <AvatarFallback>{comment.username[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-gray-300">{comment.username}</p>
                                    <p className="text-sm text-white">{comment.content}</p>
                                </div>
                                {/* Optional Delete Button for Owner */}
                                {comment.user_id && (
                                    <button
                                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity p-1 text-xs font-bold uppercase"
                                        onClick={async () => {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (user?.id === comment.user_id) {
                                                await supabase.from("comments").delete().eq("id", comment.id);
                                                fetchComments();
                                            } else {
                                                alert("You can only delete your own comments!");
                                            }
                                        }}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 flex gap-2">
                    <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Kuch toh bolo..."
                        className="flex-1 bg-white/10 rounded-full px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newComment.trim()}
                        className="bg-primary p-2 rounded-full text-white disabled:opacity-50"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
