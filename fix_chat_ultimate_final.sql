-- ==============================================================================
-- 🚀 ULTIMATE CHAT REPAIR - NO MORE DISAPPEARING MESSAGES
-- ==============================================================================
-- This script fixes the "disappearing on refresh" and "unreliable realtime" issues
-- by switching to a high-performance boolean check for RLS.
-- ==============================================================================

-- 1. Clean up everything first (Nuke existing policies)
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Also Drop the NEW policy names in case of re-run
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "participants_select" ON public.conversation_participants;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;

-- Remove old slow functions
DROP FUNCTION IF EXISTS public.get_my_conversation_ids();
DROP FUNCTION IF EXISTS public.check_chat_membership(uuid);

-- 2. Create optimized boolean membership check
CREATE OR REPLACE FUNCTION public.is_chat_member(chat_id uuid)
RETURNS boolean AS $$
BEGIN
  -- If user is explicitly listed in the conversation row (DMs/Owner)
  IF EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = chat_id 
    AND (user1_id = auth.uid() OR user2_id = auth.uid() OR owner_id = auth.uid())
  ) THEN
    RETURN TRUE;
  END IF;

  -- Or if user is in the participants table (Groups)
  IF EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = chat_id AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Apply simplified, high-speed policies
-- Conversations
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING ( public.is_chat_member(id) );

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK ( auth.uid() = user1_id OR auth.uid() = user2_id OR auth.uid() = owner_id );

-- Participants
CREATE POLICY "participants_select" ON public.conversation_participants
  FOR SELECT USING ( public.is_chat_member(conversation_id) );

-- Messages
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING ( public.is_chat_member(conversation_id) );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK ( 
    auth.uid() = sender_id AND 
    public.is_chat_member(conversation_id) 
  );

-- 4. Force Real-time and Replica Identity
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Ensure they are in the publication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
END $$;
