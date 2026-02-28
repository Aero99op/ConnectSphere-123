-- ==============================================================================
-- 🚀 FINAL CHAT RLS FIX - NO MORE 500 ERRORS NO MORE RECURSION
-- ==============================================================================
-- The root cause of the recursion was that the conversations policy queried
-- conversation_participants, and conversation_participants queried conversations.
-- Postgres planner detected a mutual dependency loop and threw 500.
--
-- FIX: We use a SECURITY DEFINER function to fetch the IDs the user is allowed
-- to access. Because it's SECURITY DEFINER, it runs as Postgres (bypassing RLS),
-- completely destroying the loop.
-- ==============================================================================

-- 1. Helper Function to securely get Conversation IDs
CREATE OR REPLACE FUNCTION public.get_my_conversation_ids()
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT id FROM public.conversations 
  WHERE user1_id = auth.uid() OR user2_id = auth.uid() OR owner_id = auth.uid()
  UNION
  SELECT conversation_id FROM public.conversation_participants 
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop all conflicting/recursive policies
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

-- Drop the old problematic function (if it exists)
DROP FUNCTION IF EXISTS public.check_chat_membership(uuid);

-- 3. Add ultra-clean, non-recursive policies
CREATE POLICY "Users can view their own conversations" ON public.conversations
  FOR SELECT USING (
    id IN (SELECT public.get_my_conversation_ids())
  );

CREATE POLICY "Users can view participants in their conversations" ON public.conversation_participants
  FOR SELECT USING (
    conversation_id IN (SELECT public.get_my_conversation_ids())
  );

CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    conversation_id IN (SELECT public.get_my_conversation_ids())
  );

CREATE POLICY "Users can send messages to their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (SELECT public.get_my_conversation_ids())
  );

-- Keep the create conversation policy simple and direct
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id OR auth.uid() = owner_id
  );
