-- 🇮🇳 ConnectSphere: Post & Quix Customization Setup
-- Adds support for Instagram-style filters, music, and emoji stickers.

-- 1. Add customization JSONB column to posts and quix
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='customization') THEN
        ALTER TABLE public.posts ADD COLUMN customization JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quix' AND column_name='customization') THEN
        ALTER TABLE public.quix ADD COLUMN customization JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Audit Log for Customization (Optional)
-- This allows us to track what kind of edits are popular.
COMMENT ON COLUMN public.posts.customization IS 'Stores filters, music_id, and emoji_stickers {filter: string, music: {id: string, name: string, url: string}, stickers: Array<{emoji: string, x: number, y: number, size: number}>}';
COMMENT ON COLUMN public.quix.customization IS 'Stores filters, music_id, and emoji_stickers {filter: string, music: {id: string, name: string, url: string}, stickers: Array<{emoji: string, x: number, y: number, size: number}>}';
