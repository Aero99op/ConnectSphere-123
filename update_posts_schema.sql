-- 🇮🇳 ConnectSphere Post Actions Hardening
-- Adds support for Remention (Repost) and Scheduling.

-- 1. Add Columns to Posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS repost_of uuid REFERENCES public.posts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone;

-- 2. Update RLS for Scheduling
-- Ensure users only see scheduled posts once they are live (handled by select policy)
DROP POLICY IF EXISTS "Public read posts" ON public.posts;
CREATE POLICY "Public read posts" ON public.posts 
FOR SELECT USING (
    scheduled_at IS NULL OR scheduled_at <= now() OR auth.uid() = user_id
);

-- 3. Trigger to auto-handle karma for reposts (optional future enhancement)
-- For now, we'll handle logical cloning in the frontend.
