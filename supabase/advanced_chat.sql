-- Advanced Chat Features: Edit / Delete Messages

-- 1. Add tracking columns to public.messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- 2. Add RLS Policy for UPDATE
-- Users can only update their own messages
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (
    auth.uid() = sender_id
  );

-- 3. Add RLS Policy for DELETE
-- Users can only delete their own messages
-- Note: 'Soft delete' (updating is_deleted to true) uses the UPDATE policy.
-- But we also enable actual DELETE just in case.
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (
    auth.uid() = sender_id
  );

-- Ensure we also send UPDATE and DELETE events via Realtime
-- (Realtime is already enabled for the table in chat_schema, 
-- but we need to ensure REPLICA IDENTITY is set correctly for UPDATE/DELETE payloads)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
