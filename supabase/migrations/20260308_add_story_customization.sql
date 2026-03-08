-- Migration: Add Customization to Stories
-- This allows preserving filters, music, and stickers when sharing Quixes to Stories.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='customization') THEN
        ALTER TABLE public.stories ADD COLUMN customization JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

COMMENT ON COLUMN public.stories.customization IS 'Stores filters, music, and emoji_stickers from shared Quixes or Posts.';
