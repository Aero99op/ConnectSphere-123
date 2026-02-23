-- Migration: Setup Chunked Storage Arrays for ConnectSphere
-- This script ensures all media tables support the 'Tod Ke Jodo' architecture 
-- by storing an array of Catbox URLs instead of a single string.

-- 1. POSTS TABLE (Main Feed)
-- Assuming 'posts' already exists with a 'file_url' text column.
-- Let's rename it and cast to an array type.
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='posts' and column_name='file_url')
  THEN
      ALTER TABLE "public"."posts" RENAME COLUMN "file_url" TO "file_urls";
      ALTER TABLE "public"."posts" ALTER COLUMN "file_urls" TYPE text[] USING array[file_urls];
  ELSEIF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='posts' and column_name='file_urls')
  THEN
      ALTER TABLE "public"."posts" ADD COLUMN "file_urls" text[] DEFAULT '{}';
  END IF;

  -- Add required metadata columns if missing
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='posts' and column_name='file_name') THEN
      ALTER TABLE "public"."posts" ADD COLUMN "file_name" text;
  END IF;

  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='posts' and column_name='file_size') THEN
      ALTER TABLE "public"."posts" ADD COLUMN "file_size" integer;
  END IF;

  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='posts' and column_name='thumbnail_url') THEN
      ALTER TABLE "public"."posts" ADD COLUMN "thumbnail_url" text;
  END IF;
END $$;


-- 2. STORIES TABLE (Kisse)
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='stories' and column_name='media_url')
  THEN
      ALTER TABLE "public"."stories" RENAME COLUMN "media_url" TO "media_urls";
      ALTER TABLE "public"."stories" ALTER COLUMN "media_urls" TYPE text[] USING array[media_urls];
  ELSEIF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='stories' and column_name='media_urls')
  THEN
      ALTER TABLE "public"."stories" ADD COLUMN "media_urls" text[] DEFAULT '{}';
  END IF;

  -- Add thumbnail for video stories
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='stories' and column_name='thumbnail_url') THEN
      ALTER TABLE "public"."stories" ADD COLUMN "thumbnail_url" text;
  END IF;
END $$;


-- 3. MESSAGES TABLE (DMs / Group Chat Media)
-- Create table if not exists (based on Task 3 of prompt)
CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "sender_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "conversation_id" uuid NOT NULL, -- Logical grouping
    "content" text,
    "file_urls" text[] DEFAULT '{}',
    "file_name" text,
    "file_size" integer,
    "thumbnail_url" text,
    "created_at" timestamp with time zone DEFAULT now()
);

-- If table already exists but needs chunking array updates
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='messages' and column_name='file_url')
  THEN
      ALTER TABLE "public"."messages" RENAME COLUMN "file_url" TO "file_urls";
      ALTER TABLE "public"."messages" ALTER COLUMN "file_urls" TYPE text[] USING array[file_urls];
  END IF;

  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='messages' and column_name='file_urls') THEN
      ALTER TABLE "public"."messages" ADD COLUMN "file_urls" text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='messages' and column_name='file_name') THEN
      ALTER TABLE "public"."messages" ADD COLUMN "file_name" text;
  END IF;

  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='messages' and column_name='file_size') THEN
      ALTER TABLE "public"."messages" ADD COLUMN "file_size" integer;
  END IF;

  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='messages' and column_name='thumbnail_url') THEN
      ALTER TABLE "public"."messages" ADD COLUMN "thumbnail_url" text;
  END IF;
END $$;

-- 4. Enable Row Level Security (RLS) on Messages
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Allow users to read messages in their chats (Simplified logic for now)
DROP POLICY IF EXISTS "Users can read own chat messages" ON "public"."messages";
CREATE POLICY "Users can read own chat messages" ON "public"."messages"
  FOR SELECT USING (auth.uid() = sender_id); -- Expand this based on a participants table

-- Allow users to insert messages
DROP POLICY IF EXISTS "Users can insert own messages" ON "public"."messages";
CREATE POLICY "Users can insert own messages" ON "public"."messages"
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
