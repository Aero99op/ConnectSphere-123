-- Add Onboarding Fields to Profiles Table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS interests TEXT[],
ADD COLUMN IF NOT EXISTS personalization JSONB DEFAULT '{}'::jsonb;

-- Optional: Update existing users to be onboarded so they don't get blocked
UPDATE public.profiles SET is_onboarded = true WHERE is_onboarded = false;
