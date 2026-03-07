-- 🧨 ConnectSphere Patch: Fix Missing Delete Policies
-- Granting users the ability to delete their own content

-- 1. Posts Table
DROP POLICY IF EXISTS "Users can delete their own posts." ON public.posts;
CREATE POLICY "Users can delete their own posts." 
ON public.posts 
FOR DELETE 
USING (auth.uid() = user_id);

-- 2. Comments Table
DROP POLICY IF EXISTS "Users can delete their own comments." ON public.comments;
CREATE POLICY "Users can delete their own comments." 
ON public.comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- 3. Stories Table
DROP POLICY IF EXISTS "Users can delete their own stories." ON public.stories;
CREATE POLICY "Users can delete their own stories." 
ON public.stories 
FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Bookmarks Table
DROP POLICY IF EXISTS "Users can remove their own bookmarks." ON public.bookmarks;
CREATE POLICY "Users can remove their own bookmarks." 
ON public.bookmarks 
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Add Update Policies (Bonus - logic safety)
DROP POLICY IF EXISTS "Users can update their own posts." ON public.posts;
CREATE POLICY "Users can update their own posts." 
ON public.posts 
FOR UPDATE 
USING (auth.uid() = user_id);
