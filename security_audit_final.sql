-- 🛡️ ConnectSphere Security Audit Final Response
-- Run this in Supabase SQL Editor
-- Fixes: MED-01, HIGH-01, and additional RLS hardening
-- All changes are idempotent (safe to run multiple times)

-- ========================================
-- MED-01 FIX: Lock down auth_otps table
-- The auth_otps table stores live OTP codes.
-- Even with RLS, anon should NEVER be able to query this table.
-- ========================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.auth_otps ENABLE ROW LEVEL SECURITY;

-- Drop any existing policy with the same name before creating
DROP POLICY IF EXISTS "deny_anon_auth_otps" ON public.auth_otps;
DROP POLICY IF EXISTS "anon_read_auth_otps" ON public.auth_otps;
DROP POLICY IF EXISTS "Allow anon read" ON public.auth_otps;

-- Explicit DENY for anon role on auth_otps
CREATE POLICY "deny_anon_auth_otps" ON public.auth_otps
  FOR ALL
  USING (auth.role() != 'anon');

-- Revoke direct table access for anon role
REVOKE ALL ON public.auth_otps FROM anon;

-- ========================================
-- MED-01 FIX: Lock down verification_tokens table
-- ========================================

ALTER TABLE IF EXISTS public.verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_verification_tokens" ON public.verification_tokens;
DROP POLICY IF EXISTS "anon_read_verification_tokens" ON public.verification_tokens;
DROP POLICY IF EXISTS "Allow anon read" ON public.verification_tokens;

CREATE POLICY "deny_anon_verification_tokens" ON public.verification_tokens
  FOR ALL
  USING (auth.role() != 'anon');

REVOKE ALL ON public.verification_tokens FROM anon;

-- ========================================
-- HIGH-01 FIX: Restrict dangerous RPC functions from anon
-- rls_auto_enable, cleanup_expired_otps should NOT be callable by anon
-- ========================================

-- Revoke EXECUTE on dangerous RPCs from anon
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM anon;

-- ========================================
-- ADDITIONAL: Ensure audit_logs is locked from anon
-- ========================================

ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_read_audit_logs" ON public.audit_logs;

CREATE POLICY "deny_anon_audit_logs" ON public.audit_logs
  FOR ALL
  USING (auth.role() != 'anon');

REVOKE ALL ON public.audit_logs FROM anon;

-- ========================================
-- ADDITIONAL: Tighten profiles table - anon can read but not write
-- ========================================

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;

-- ========================================
-- VERIFICATION QUERIES (run these after to confirm)
-- ========================================

-- Test 1: This should return EMPTY (no rows) when run as anon:
-- SELECT * FROM public.auth_otps LIMIT 1;

-- Test 2: This should FAIL when called as anon:
-- SELECT public.rls_auto_enable();

-- Test 3: This should return EMPTY when run as anon:
-- SELECT * FROM public.verification_tokens LIMIT 1;

-- ========================================
-- VULN-011 FIX: Dedicated call_logs table for call metadata
-- Moves call logs out of the freeform 'messages' table
-- ========================================

CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
    duration INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see call logs for conversations they are part of
DROP POLICY IF EXISTS "Users can view call logs for their conversations" ON public.call_logs;
CREATE POLICY "Users can view call logs for their conversations" ON public.call_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = call_logs.conversation_id
            AND cp.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = call_logs.conversation_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

-- Policy: Users can only insert call logs for conversations they are part of
DROP POLICY IF EXISTS "Users can insert call logs for their conversations" ON public.call_logs;
CREATE POLICY "Users can insert call logs for their conversations" ON public.call_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = call_logs.conversation_id
            AND cp.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = call_logs.conversation_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_conversation_id ON public.call_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON public.call_logs(caller_id);

-- 🛡️ DATABASE SECURITY AUDIT FIXES COMPLETE
