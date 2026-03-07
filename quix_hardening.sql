-- 🛡️ ConnectSphere: Quix Security Hardening
-- This script secures the Quix-related tables against common exploits.

-- 1. Unique Constraints (Spam Protection)
-- Ensures a user can only like/bookmark/repost once.
ALTER TABLE public.quix_likes DROP CONSTRAINT IF EXISTS quix_likes_user_id_quix_id_key;
ALTER TABLE public.quix_likes ADD CONSTRAINT quix_likes_user_id_quix_id_key UNIQUE (user_id, quix_id);

ALTER TABLE public.quix_bookmarks DROP CONSTRAINT IF EXISTS quix_bookmarks_user_id_quix_id_key;
ALTER TABLE public.quix_bookmarks ADD CONSTRAINT quix_bookmarks_user_id_quix_id_key UNIQUE (user_id, quix_id);

ALTER TABLE public.quix_reposts DROP CONSTRAINT IF EXISTS quix_reposts_user_id_quix_id_key;
ALTER TABLE public.quix_reposts ADD CONSTRAINT quix_reposts_user_id_quix_id_key UNIQUE (user_id, quix_id);

-- 2. Forced User ID (Anti-Impersonation)
CREATE OR REPLACE FUNCTION public.force_quix_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_force_quix_user_id ON public.quix;
CREATE TRIGGER tr_force_quix_user_id
    BEFORE INSERT ON public.quix
    FOR EACH ROW EXECUTE FUNCTION public.force_quix_user_id();

DROP TRIGGER IF EXISTS tr_force_quix_like_user_id ON public.quix_likes;
CREATE TRIGGER tr_force_quix_like_user_id
    BEFORE INSERT ON public.quix_likes
    FOR EACH ROW EXECUTE FUNCTION public.force_quix_user_id();

-- 3. Prevent Manual Count Manipulation
-- Only the system trigger should update these columns.
CREATE OR REPLACE FUNCTION public.protect_quix_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.likes_count != NEW.likes_count OR OLD.reposts_count != NEW.reposts_count) AND auth.role() = 'authenticated' THEN
        -- Only allow system-level updates or reject if it's from a user
        -- Note: Superuser/Triggers bypass RLS but we want to catch explicit updates from API
        NEW.likes_count := OLD.likes_count;
        NEW.reposts_count := OLD.reposts_count;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_protect_quix_counts ON public.quix;
CREATE TRIGGER tr_protect_quix_counts
    BEFORE UPDATE ON public.quix
    FOR EACH ROW EXECUTE FUNCTION public.protect_quix_counts();

-- 4. Strict RLS Refinement
-- Explicitly denying updates/deletes to others' data.

-- Quix
ALTER TABLE public.quix DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quix are viewable by everyone" ON public.quix;
CREATE POLICY "Quix are viewable by everyone" ON public.quix FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own quix" ON public.quix;
CREATE POLICY "Users can insert their own quix" ON public.quix 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own quix" ON public.quix;
CREATE POLICY "Users can update their own quix" ON public.quix 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own quix" ON public.quix;
CREATE POLICY "Users can delete their own quix" ON public.quix 
FOR DELETE USING (auth.uid() = user_id);

-- Likes
DROP POLICY IF EXISTS "Users can unlike quix" ON public.quix_likes;
CREATE POLICY "Users can unlike quix" ON public.quix_likes 
FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks
DROP POLICY IF EXISTS "Users can unbookmark quix" ON public.quix_bookmarks;
CREATE POLICY "Users can unbookmark quix" ON public.quix_bookmarks 
FOR DELETE USING (auth.uid() = user_id);

-- 5. Real-time Safety
-- Add new tables to the publication for instant updates.
-- Use a DO block to safely add tables without erroring if they already exist in the publication
DO $$
BEGIN
    -- This is a bit complex in standard PG but for Supabase we can try to drop and recreate for simplicity
    -- or just catch the error. Standard 'ADD TABLE' often works fine or we can use SET TABLE.
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quix, public.quix_likes, public.quix_reposts;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Tables already in publication or another error occurred';
END $$;

-- 6. Repost Trigger (Performance)
CREATE OR REPLACE FUNCTION public.handle_quix_repost()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.quix SET reposts_count = reposts_count + 1 WHERE id = NEW.quix_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.quix SET reposts_count = reposts_count - 1 WHERE id = OLD.quix_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_quix_repost ON public.quix_reposts;
CREATE TRIGGER on_quix_repost
    AFTER INSERT OR DELETE ON public.quix_reposts
    FOR EACH ROW EXECUTE FUNCTION public.handle_quix_repost();
