-- 🔒 ConnectSphere: Security Hardening v2
-- This script fixes RLS gaps and aligns the schema with guest-friendly logic.

-- 1. Reports Schema Relaxation
-- Allow guest reports (if user_id is null) or just prevent drift.
ALTER TABLE public.reports ALTER COLUMN user_id DROP NOT NULL;

-- 2. Missing DELETE/UPDATE Policies
-- Ensuring owner-only control across all social tables.

-- Posts
DROP POLICY IF EXISTS "Users can delete their own posts." ON public.posts;
CREATE POLICY "Users can delete their own posts." ON public.posts 
FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts." ON public.posts;
CREATE POLICY "Users can update their own posts." ON public.posts 
FOR UPDATE USING (auth.uid() = user_id);

-- Comments
DROP POLICY IF EXISTS "Users can delete their own comments." ON public.comments;
CREATE POLICY "Users can delete their own comments." ON public.comments 
FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comments." ON public.comments;
CREATE POLICY "Users can update their own comments." ON public.comments 
FOR UPDATE USING (auth.uid() = user_id);

-- Stories
DROP POLICY IF EXISTS "Users can delete their own stories." ON public.stories;
CREATE POLICY "Users can delete their own stories." ON public.stories 
FOR DELETE USING (auth.uid() = user_id);

-- 3. Function Security (Search Path Hardening)
-- Preventing search_path hijacking for SECURITY DEFINER functions.

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.increment_karma(uuid) SET search_path = public;

-- 4. Audit Log Policies (Privacy Fix)
-- Ensure users can't see each other's audit logs.
DROP POLICY IF EXISTS "Private audit logs" ON public.audit_logs;
CREATE POLICY "Private audit logs" ON public.audit_logs 
FOR SELECT USING (auth.uid() = user_id);

-- 5. Real-time Replication (Safety Check)
-- Ensure only necessary tables are replicated.
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.posts, public.stories, public.comments;
