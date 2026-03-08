-- Add presence tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- Policy to allow users to update their own presence status
DROP POLICY IF EXISTS "Users can update their own presence" ON public.profiles;
CREATE POLICY "Users can update their own presence" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure profiles are included in realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
