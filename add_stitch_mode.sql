-- Add stitch_mode to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stitch_mode BOOLEAN DEFAULT FALSE;

-- Optional: Create an index if filtering by stitch_mode becomes common
-- CREATE INDEX idx_profiles_stitch_mode ON public.profiles(stitch_mode);
