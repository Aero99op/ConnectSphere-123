-- ═══════════════════════════════════════════════
-- GHOST MODE & HIDDEN STATUS MIGRATION
-- ═══════════════════════════════════════════════

-- 1. Add Ghost Mode & Hidden Status columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ghost_mode_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hide_online_status BOOLEAN DEFAULT false;

-- 2. Add delivery tracking to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;

-- 3. RPC: Mark a single message as delivered
CREATE OR REPLACE FUNCTION mark_message_delivered(msg_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.messages
  SET is_delivered = true
  WHERE id = msg_id
    AND sender_id != auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Batch mark all undelivered messages in a conversation as delivered
CREATE OR REPLACE FUNCTION mark_messages_delivered_in_conv(conv_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.messages
  SET is_delivered = true
  WHERE conversation_id = conv_id
    AND sender_id != auth.uid()
    AND is_delivered = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════
-- E2E ENCRYPTION & QUANTUM (PQC) MIGRATION
-- ═══════════════════════════════════════════════

-- 5. Add Cryptography Public Keys to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ecdh_public_key TEXT,
ADD COLUMN IF NOT EXISTS ecdsa_public_key TEXT,
ADD COLUMN IF NOT EXISTS mlkem_public_key TEXT;

-- 6. Add E2E Message Payloads to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS encrypted_keys JSONB,
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS signature TEXT;

-- Realtime is already enabled for these tables in ultimate_schema.sql, no need to add again
