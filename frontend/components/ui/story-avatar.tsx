"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { StoryViewer } from "./story-viewer";

interface StoryAvatarProps {
    user: {
        id: string;
        username: string;
        full_name?: string;
        avatar_url?: string;
    };
    className?: string;
    onClick?: () => void;
}

export function StoryAvatar({ user, className, onClick }: StoryAvatarProps) {
    const [stories, setStories] = useState<any[]>([]);
    const [hasUnseen, setHasUnseen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        
        // Fetch active stories for this user
        const fetchStories = async () => {
            try {
                const res = await fetch(`/api/stories?userId=${user.id}`);
                const data = await res.json();
                if (data.stories && data.stories.length > 0) {
                    setStories(data.stories);
                    setHasUnseen(true); // Simplified: Assume all are unseen initially
                }
            } catch (error) {
                console.error("Failed to load stories for avatar", error);
            }
        };

        fetchStories();
    }, [user?.id]);

    const handleAvatarClick = (e: React.MouseEvent) => {
        if (stories.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setHasUnseen(false);
            setViewerOpen(true);
        } else if (onClick) {
            onClick();
        }
    };

    if (!user) return null;

    return (
        <>
            <div 
                className={cn(
                    "relative group cursor-pointer shrink-0 rounded-full",
                    hasUnseen ? "p-[3px] bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-500" : "p-[2px] bg-zinc-800",
                    className
                )}
                onClick={handleAvatarClick}
            >
                <div className={cn("bg-[#050507] p-[2px] w-full h-full", className?.includes('rounded') ? "" : "rounded-full")}>
                    <Avatar className={cn("w-full h-full", className?.includes('rounded') ? "" : "rounded-full")}>
                        <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="object-cover" />
                        <AvatarFallback className="bg-zinc-900 font-display font-black text-white">
                            {user.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {viewerOpen && (
                <StoryViewer 
                    user={user} 
                    stories={stories} 
                    onClose={() => setViewerOpen(false)} 
                />
            )}
        </>
    );
}
