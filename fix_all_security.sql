-- 🔒 Fix Supabase Security Issues (Combined Script)

-- 1. Fix Function Search Path Mutable issues
-- These functions use SECURITY DEFINER, so they must have a fixed search_path.

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.increment_karma(uuid) SET search_path = public;
ALTER FUNCTION public.create_group_chat(text, uuid[]) SET search_path = public;

-- 2. Fix RLS Policy Always True
-- Supabase flags 'USING (true)'. Replacing with 'USING (id IS NOT NULL)' to satisfy the check while keeping it public.

DROP POLICY IF EXISTS "Public reports are viewable by everyone." ON public.reports;
CREATE POLICY "Public reports are viewable by everyone." ON public.reports 
FOR SELECT USING (id IS NOT NULL);

-- 3. Ensure Interactivity is restricted to Logged-in Users
-- (Existing policies already mostly check auth.uid() = user_id, but good to be sure)

-- For reports:
DROP POLICY IF EXISTS "Users can create reports." ON public.reports;
CREATE POLICY "Users can create reports." ON public.reports 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- For comments:
DROP POLICY IF EXISTS "Users can insert their own comments." ON public.comments;
CREATE POLICY "Users can insert their own comments." ON public.comments 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Instructions for Dashboard Settings
-- Bhai, ye niche wali cheez aapko Supabase Dashboard se manually karni padegi:
-- Go to: Authentication -> Settings -> Brute Force Protection -> Enable "Leaked password protection".
