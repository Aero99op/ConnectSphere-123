-- ============================================
-- ConnectSphere: Complete Profile Schema Fix
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- Step 1: Add missing columns required by auth.ts
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Step 2: Add onboarding & personalization columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS interests TEXT[],
ADD COLUMN IF NOT EXISTS personalization JSONB DEFAULT '{}'::jsonb;

-- Step 3: Mark ALL existing users as already onboarded
-- so they go straight to homepage, not onboarding screen
UPDATE public.profiles SET is_onboarded = true;

-- Step 4: Verify it worked (check the output!)
SELECT id, full_name, email, is_onboarded, country FROM profiles LIMIT 5;
