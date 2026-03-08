-- Add read status to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- Policy to allow marking messages as read (receiver can update)
-- A user can update a message if they are the recipient of the conversation
DROP POLICY IF EXISTS "Messages: Mark as Read" ON public.messages;
CREATE POLICY "Messages: Mark as Read" ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() != sender_id -- Receiver marks it read, not the sender
  );

-- Function to mark all messages in a conversation as read for the current user
CREATE OR REPLACE FUNCTION mark_messages_as_read(conv_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.messages
  SET is_read = true, read_at = now()
  WHERE conversation_id = conv_id
    AND sender_id != auth.uid()
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
