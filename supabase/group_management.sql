-- Group Management Functions for Guptugu
-- Run this in Supabase SQL editor to add Leave Group and Add Members functionality

-- 1. Fix RLS Policy for conversation_participants so members can see other members
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;

-- Create updated policy
CREATE POLICY "Users can view participants in their conversations" ON public.conversation_participants
  FOR SELECT USING (
    user_id = auth.uid() -- Can always see yourself
    OR
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp2
        WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.user_id = auth.uid()
    )
  );

-- 2. Leave Group RPC
CREATE OR REPLACE FUNCTION public.leave_group(conv_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if it's a group
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = conv_id AND is_group = true) THEN
    RAISE EXCEPTION 'Not a group conversation';
  END IF;

  -- Delete the caller from the participants
  DELETE FROM public.conversation_participants
  WHERE conversation_id = conv_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Add Members RPC
CREATE OR REPLACE FUNCTION public.add_group_members(conv_id uuid, new_member_ids uuid[])
RETURNS void AS $$
DECLARE
  member_id uuid;
BEGIN
  -- Check if it's a group
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = conv_id AND is_group = true) THEN
    RAISE EXCEPTION 'Not a group conversation';
  END IF;

  -- Check if caller is already a member (only members can add others)
  IF NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conv_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only group members can add new members';
  END IF;

  -- Insert new participants
  FOREACH member_id IN ARRAY new_member_ids
  LOOP
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (conv_id, member_id)
    ON CONFLICT DO NOTHING; -- Ignore if already a member
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
