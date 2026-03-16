-- 🛡️ ConnectSphere Security Fixes v3 (Audit Response)
-- Run this in Supabase SQL Editor
-- All changes are idempotent (safe to run multiple times)

-- ========================================
-- HIGH-002 FIX: Messages INSERT — Add conversation membership check
-- Before: Any authenticated user could inject messages into ANY conversation
-- After: Only conversation members can send messages
-- ========================================
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
CREATE POLICY "Users can send messages to their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      -- DM: user must be user1 or user2
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
      )
      OR
      -- Group: user must be a participant
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
      )
    )
  );

-- ========================================
-- HIGH-004 FIX: increment_karma — Restrict to self-only
-- Before: Any user could increment karma for any other user
-- After: Users can only increment their own karma
-- ========================================
CREATE OR REPLACE FUNCTION public.increment_karma(user_id_param uuid)
RETURNS void AS $$
BEGIN
  -- SECURITY FIX: Only allow incrementing your own karma
  IF user_id_param != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: Cannot modify another user''s karma';
  END IF;
  
  UPDATE public.profiles
  SET karma_points = karma_points + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- MED-001 FIX: Missing DELETE/UPDATE RLS policies
-- ========================================

-- Posts: Users can delete/update their own posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts" ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id);

-- Comments: Users can delete their own comments
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- Stories: Users can delete their own stories
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;
CREATE POLICY "Users can delete their own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications: Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = recipient_id);

-- Notifications: Users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

-- Bookmarks: Users can delete their own bookmarks
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete their own bookmarks" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: Users can delete their own messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Reports: Users can update their own reports (e.g., add more info)
DROP POLICY IF EXISTS "Users can update their own reports" ON public.reports;
CREATE POLICY "Users can update their own reports" ON public.reports
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- MED-003 FIX: create_group_chat — Validate member IDs
-- Users can still create groups, but can only add people they follow
-- ========================================
CREATE OR REPLACE FUNCTION public.create_group_chat(name text, member_ids uuid[])
RETURNS uuid AS $$
DECLARE
  new_conv_id uuid;
  member_id uuid;
BEGIN
  -- Create Conversation
  INSERT INTO public.conversations (is_group, group_name, owner_id)
  VALUES (true, name, auth.uid())
  RETURNING id INTO new_conv_id;

  -- Insert Participants (only people the creator follows)
  FOREACH member_id IN ARRAY member_ids
  LOOP
    -- SECURITY FIX (MED-003): Only allow adding users that the creator follows
    IF EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = member_id) THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (new_conv_id, member_id);
    END IF;
  END LOOP;

  -- Add Creator as participant too
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (new_conv_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN new_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- MED-008 FIX: Prevent duplicate DM conversations
-- A partial unique index prevents creating multiple DMs between the same 2 users
-- ========================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_dm_conversation 
ON public.conversations (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))
WHERE is_group = false OR is_group IS NULL;

-- 🛡️ DATABASE SECURITY FIXES COMPLETE
