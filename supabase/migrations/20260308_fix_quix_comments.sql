-- Migration: Fix Quix Comments
-- 1. Make post_id nullable to support Quix comments
ALTER TABLE public.comments ALTER COLUMN post_id DROP NOT NULL;

-- 2. Add quix_id column
ALTER TABLE public.comments ADD COLUMN quix_id UUID REFERENCES public.quix(id) ON DELETE CASCADE;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_comments_quix_id ON public.comments(quix_id);

-- 4. Enable RLS (Implicitly covered by existing policies, but good for clarity)
-- Ensure 'select' policy includes the new column (default does)
-- Existing policies use auth.uid() = user_id, which still works.
