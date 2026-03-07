-- 🚀 ConnectSphere "Once and For All" Like System Fix
-- Run this in your Supabase SQL Editor

-- 1. Ensure likes_count exists on posts (should be there based on schema)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;

-- 2. Add likes_count to stories (missing in current schema but needed for consistency)
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;

-- 3. Function to handle post likes (increment/decrement)
CREATE OR REPLACE FUNCTION public.handle_post_like_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts
        SET likes_count = COALESCE(likes_count, 0) + 1
        WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts
        SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to handle story likes (increment/decrement)
CREATE OR REPLACE FUNCTION public.handle_story_like_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.stories
        SET likes_count = COALESCE(likes_count, 0) + 1
        WHERE id = NEW.story_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.stories
        SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
        WHERE id = OLD.story_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-create Triggers
DROP TRIGGER IF EXISTS on_post_like_added_removed ON public.post_likes;
CREATE TRIGGER on_post_like_added_removed
    AFTER INSERT OR DELETE ON public.post_likes
    FOR EACH ROW EXECUTE PROCEDURE public.handle_post_like_change();

DROP TRIGGER IF EXISTS on_story_like_added_removed ON public.story_likes;
CREATE TRIGGER on_story_like_added_removed
    AFTER INSERT OR DELETE ON public.story_likes
    FOR EACH ROW EXECUTE PROCEDURE public.handle_story_like_change();

-- 6. Recalculate existing counts (Cleanup)
UPDATE public.posts p
SET likes_count = (SELECT count(*) FROM public.post_likes pl WHERE pl.post_id = p.id);

UPDATE public.stories s
SET likes_count = (SELECT count(*) FROM public.story_likes sl WHERE sl.story_id = s.id);
