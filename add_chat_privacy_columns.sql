-- ==========================================
-- ADD PRIVACY COLUMNS TO PROFILES TABLE
-- Run this in your Supabase SQL Editor
-- ==========================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS send_read_receipts BOOLEAN DEFAULT TRUE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hide_online_status BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ghost_mode_until TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Notify: Successfully added new privacy columns
SELECT 'Columns added successfully!' as status;
