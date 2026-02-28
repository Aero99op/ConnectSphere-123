-- ==============================================================================
-- 🚀 RLS INFINITE RECURSION FIX (Conversations & Participants)
-- ==============================================================================
-- The previous policies caused a circular dependency (`conversations` checked `conversation_participants`,
-- and `conversation_participants` checked `conversations`).
-- 
-- Fix: We use a SECURITY DEFINER function to check membership. This function runs as the
-- table owner (bypassing RLS during the check) and therefore prevents the infinite loop. Make sure 
-- to run this entirely in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Create the Security Definer Helper Function
CREATE OR REPLACE FUNCTION public.check_chat_membership(conv_id uuid)
RETURNS boolean AS $$
DECLARE
  is_member boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversations c
    LEFT JOIN public.conversation_participants cp ON c.id = cp.conversation_id
    WHERE c.id = conv_id
    AND (
      c.user1_id = auth.uid() OR 
      c.user2_id = auth.uid() OR 
      c.owner_id = auth.uid() OR 
      cp.user_id = auth.uid()
    )
  ) INTO is_member;
  
  RETURN is_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update Conversations Policy
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations
  FOR SELECT USING ( public.check_chat_membership(id) );

-- 3. Update Conversation Participants Policy
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants in their conversations" ON public.conversation_participants
  FOR SELECT USING ( public.check_chat_membership(conversation_id) );

-- 4. Update Messages Policy (to use the same efficient check)
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING ( public.check_chat_membership(conversation_id) );
