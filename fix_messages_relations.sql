-- ==============================================================================
-- 🚀 FIX: Add post_id and story_id to messages
-- ==============================================================================
-- The frontend is querying "messages" and joining "posts" and "stories".
-- This script adds the missing foreign key relationships which resolves 
-- the 400 Bad Request error.
-- ==============================================================================

DO $$
BEGIN
  -- Add post_id if missing
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='messages' and column_name='post_id') THEN
      ALTER TABLE "public"."messages" ADD COLUMN "post_id" uuid REFERENCES "public"."posts"("id") ON DELETE SET NULL;
  END IF;

  -- Add story_id if missing
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='messages' and column_name='story_id') THEN
      ALTER TABLE "public"."messages" ADD COLUMN "story_id" uuid REFERENCES "public"."stories"("id") ON DELETE SET NULL;
  END IF;
END $$;
