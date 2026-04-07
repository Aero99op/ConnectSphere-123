"use client";

import { useEffect, useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { StoryViewer } from "./story-viewer";
import { motion } from "framer-motion";

interface StoryAvatarProps {
    user: {
        id: string;
        username: string;
        full_name?: string;
        avatar_url?: string;
    };
    className?: string;
    onClick?: () => void;
    onLongPress?: () => void;
}

export function StoryAvatar({ user, className, onClick, onLongPress }: StoryAvatarProps) {
    const [stories, setStories] = useState<any[]>([]);
    const [hasUnseen, setHasUnseen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressTriggered = useRef(false);

    const startPress = () => {
        isLongPressTriggered.current = false;
        timerRef.current = setTimeout(() => {
            isLongPressTriggered.current = true;
            if (onLongPress) onLongPress();
        }, 500);
    };

    const endPress = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    useEffect(() => {
        if (!user?.id) return;
        
        // Fetch active stories for this user
        const fetchStories = async () => {
            try {
                const res = await fetch(`/api/stories?userId=${user.id}`);
                const data = await res.json();
                if (data.stories && data.stories.length > 0) {
                    setStories(data.stories);
                    setHasUnseen(true);
                }
            } catch (error) {
                console.error("Failed to load stories for avatar", error);
            }
        };

        fetchStories();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [user?.id]);

    const handleAvatarClick = (e: React.MouseEvent) => {
        // If it was a long press, do nothing and prevent the click action
        if (isLongPressTriggered.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

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
            <motion.div 
                className={cn(
                    "relative group cursor-pointer shrink-0 transition-transform duration-200 active:scale-95",
                    className?.includes('rounded') ? "" : "rounded-full",
                    hasUnseen ? "p-[3px] bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-500" : "p-[2px] bg-zinc-800",
                    className
                )}
                onPointerDown={startPress}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onPointerCancel={endPress}
                onClick={handleAvatarClick}
                whileTap={{ scale: 0.96 }}
            >
                <div className={cn("bg-[#050507] p-[2px] w-full h-full", className?.includes('rounded') ? className.split(' ').find(c => c.startsWith('rounded')) : "rounded-full")}>
                    <Avatar className={cn("w-full h-full", className?.includes('rounded') ? className.split(' ').find(c => c.startsWith('rounded')) : "rounded-full")}>
                        <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="object-cover" />
                        <AvatarFallback className="bg-zinc-900 font-display font-black text-white">
                            {user.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </motion.div>

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
