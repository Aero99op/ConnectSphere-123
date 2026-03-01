-- Add deleted_for column for "Delete for me"
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_for uuid[] DEFAULT '{}';

-- Create an RPC to safely update the deleted_for array
CREATE OR REPLACE FUNCTION delete_message_for_me(msg_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user is a participant of the conversation this message belongs to
  IF EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE m.id = msg_id AND cp.user_id = auth.uid()
  ) THEN
      UPDATE public.messages
      SET deleted_for = array_append(deleted_for, auth.uid())
      WHERE id = msg_id AND NOT (auth.uid() = ANY(deleted_for));
  END IF;
END;
$$;
