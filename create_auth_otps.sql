-- Create OTP Verifications table for Cloudflare MailChannels Juggad
CREATE TABLE IF NOT EXISTS public.auth_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    action TEXT NOT NULL, -- 'signup' or 'login'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_auth_otps_email ON public.auth_otps(email);

-- Optional: Create a function/trigger to auto-delete expired OTPs, 
-- or we can just ignore them and filter them out in queries.

-- RLS Policies (Service Role only should access this table)
ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;

-- Allow nothing for public, service_role bypasses RLS anyway.
-- So we just leave it so no anon/authenticated users can select OTPs directly.
