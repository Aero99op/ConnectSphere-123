-- 🛡️ Fix RLS for Report Creation and Feed Visibility

-- 0. Relax user_id constraint to allow Guest Reports
ALTER TABLE public.reports ALTER COLUMN user_id DROP NOT NULL;

-- 1. Enable INSERT for Reports
-- Allow authenticated users to create reports with their ID
DROP POLICY IF EXISTS "Users can insert reports" ON public.reports;
CREATE POLICY "Users can insert reports" 
ON public.reports 
FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

-- 2. Enable SELECT for Reports
-- Allow everyone to view reports (so feed works)
DROP POLICY IF EXISTS "Everyone can view reports" ON public.reports;
CREATE POLICY "Everyone can view reports" 
ON public.reports 
FOR SELECT 
TO authenticated, anon
USING (true);

-- 3. Profile Access
-- Ensure users can view profiles (to see official/user info in reports)
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;
CREATE POLICY "Everyone can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated, anon
USING (true);

-- 4. Report Updates Access
-- Allow everyone to see the history of a report
DROP POLICY IF EXISTS "Everyone can view report updates" ON public.report_updates;
CREATE POLICY "Everyone can view report updates" 
ON public.report_updates 
FOR SELECT 
TO authenticated, anon
USING (true);
