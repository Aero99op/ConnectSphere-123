-- 1. Promote Guest User to Official (Juggad for testing)
UPDATE public.profiles 
SET role = 'official' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'guest@connectsphere.com'
);

-- 2. Allow officials to update report status
DROP POLICY IF EXISTS "Officials can update report status" ON public.reports;

CREATE POLICY "Officials can update report status" 
ON public.reports 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'official'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'official'
  )
);

-- 3. Ensure officials can insert into report_updates
DROP POLICY IF EXISTS "Officials can insert report updates" ON public.report_updates;

CREATE POLICY "Officials can insert report updates"
ON public.report_updates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'official'
  )
);
