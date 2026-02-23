-- 🔒 Security Fixes: Add Missing RLS Policies

-- 1. Posts: Allow users to Update and Delete their own posts
create policy "Users can update their own posts." on public.posts
  for update using (auth.uid() = user_id);

create policy "Users can delete their own posts." on public.posts
  for delete using (auth.uid() = user_id);

-- 2. Comments: Allow users to Update and Delete their own comments
create policy "Users can update their own comments." on public.comments
  for update using (auth.uid() = user_id);

create policy "Users can delete their own comments." on public.comments
  for delete using (auth.uid() = user_id);

-- 3. Stories: Allow users to Delete their own stories (Updates rare for stories)
create policy "Users can delete their own stories." on public.stories
  for delete using (auth.uid() = user_id);

-- 4. Reports: Allow users to manage their reports ONLY if they are still 'pending'
-- Once a report is accepted/working, it becomes official record and shouldn't be deleted easily.
create policy "Users can delete their pending reports." on public.reports
  for delete using (auth.uid() = user_id and status = 'pending');

create policy "Users can update their pending reports." on public.reports
  for update using (auth.uid() = user_id and status = 'pending');

-- 5. Bookmarks: Allow users to remove bookmarks (Delete)
create policy "Users can remove their own bookmarks." on public.bookmarks
  for delete using (auth.uid() = user_id);
