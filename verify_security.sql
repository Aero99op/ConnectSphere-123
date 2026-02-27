-- 🔍 ConnectSphere Security Verification Script
-- Run this in your Supabase SQL Editor to verify fixes.

-- 1. Check Function Search Path
-- These should all return 'public'
SELECT 
    proname as function_name, 
    proconfig as configuration
FROM pg_proc 
WHERE proname IN ('handle_new_user', 'increment_karma', 'create_group_chat');

-- 2. Verify RLS Policy on Reports
-- Should NOT see 'true' in the definition, instead 'id IS NOT NULL'
SELECT 
    schemaname, tablename, policyname, qual as definition 
FROM pg_policies 
WHERE tablename = 'reports' AND schemaname = 'public';

-- 3. Verify Table RLS is Enabled
-- Should be 't' (true)
SELECT 
    relname as table_name, 
    relrowsecurity as rls_enabled 
FROM pg_class c 
JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE n.nspname = 'public' 
AND relname IN ('reports', 'comments', 'posts', 'stories');
