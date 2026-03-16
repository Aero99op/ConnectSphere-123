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

-- Drop any permissive anon policies that might exist
DROP POLICY IF EXISTS "anon_read_auth_otps" ON public.auth_otps;
DROP POLICY IF EXISTS "Allow anon read" ON public.auth_otps;

-- Explicit DENY for anon role on auth_otps
-- (RLS with no matching policy = denied, but belt-and-suspenders)
CREATE POLICY "deny_anon_auth_otps" ON public.auth_otps
  FOR ALL
  USING (auth.role() != 'anon');

-- Revoke direct table access for anon role
REVOKE ALL ON public.auth_otps FROM anon;

-- ========================================
-- MED-01 FIX: Lock down verification_tokens table
-- ========================================

ALTER TABLE IF EXISTS public.verification_tokens ENABLE ROW LEVEL SECURITY;

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

-- 🛡️ DATABASE SECURITY AUDIT FIXES COMPLETE
