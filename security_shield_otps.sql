-- ConnectSphere Authentication Security Shield
-- This script hardens the auth system making it foolproof.

-- 1. Ensure auth_otps table exists with strict constraints
CREATE TABLE IF NOT EXISTS public.auth_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 2. Create index to prevent slow lookups during brute-force attempts
CREATE INDEX IF NOT EXISTS idx_auth_otps_email ON public.auth_otps(email);

-- 3. Absolute Security: Delete all RLS policies on auth_otps to reset them
DROP POLICY IF EXISTS "Deny all public access to OTPs" ON public.auth_otps;
DROP POLICY IF EXISTS "Allow service role full access" ON public.auth_otps;

-- 4. Enable RLS
ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;

-- 5. Strict Zero-Trust Policy for Public / Authenticated Roles
-- NO ONE except the internal server (Service Role) can read or write OTPs.
-- This prevents any malicious user from querying the OTP table from the frontend client.
CREATE POLICY "Deny all public access to OTPs"
ON public.auth_otps
FOR ALL 
TO public, authenticated, anon
USING (false);

-- Note: The Service Role Key (used in the Next.js backend) automatically bypasses RLS,
-- ensuring the edge API can still manage OTPs while keeping it invisible to attackers.

-- 6. Rate Limiting Cleanup (Optional, but good for DB health)
-- A function to quickly delete expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_otps WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
