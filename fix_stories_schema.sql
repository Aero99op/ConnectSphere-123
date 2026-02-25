-- ConnectSphere Stories Schema Fix
-- This migration updates the stories table to support chunked uploads (arrays) and thumbnails.

-- 1. Rename media_url to media_url_old (optional, for safety)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='media_url') THEN
        ALTER TABLE public.stories RENAME COLUMN media_url TO media_url_old;
    END IF;
END $$;

-- 2. Add media_urls (text array) and thumbnail_url
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- 3. Migration: Move single URL to array if exists
UPDATE public.stories SET media_urls = ARRAY[media_url_old] WHERE media_url_old IS NOT NULL AND (media_urls = '{}' OR media_urls IS NULL);

-- 4. Mark column as NOT NULL after migration
ALTER TABLE public.stories ALTER COLUMN media_urls SET NOT NULL;

-- 5. Drop old column if you are confident
-- ALTER TABLE public.stories DROP COLUMN media_url_old;
