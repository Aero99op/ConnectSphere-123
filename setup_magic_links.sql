-- ConnectSphere Magic Link Security Shield
-- Replaces OTP with Secure Tokens for "Unlimited" Verification

-- 1. Create verification_tokens table
CREATE TABLE IF NOT EXISTS public.verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL PRIMARY KEY,
    expires TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add email_verified column to profiles if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'email_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN email_verified TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. Security: RLS
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.verification_tokens;
CREATE POLICY "Service role only" ON public.verification_tokens
FOR ALL TO public USING (false);

-- 4. Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_verification_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.verification_tokens WHERE expires < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
