-- Fix Persistence: Add missing post_likes table and check comments

-- 1. Create post_likes table
create table if not exists public.post_likes (
    id uuid default gen_random_uuid() primary key,
    post_id uuid references public.posts(id) on delete cascade not null,
    user_id uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(post_id, user_id)
);

-- 2. Enable RLS
alter table public.post_likes enable row level security;

-- 3. Policies for post_likes
drop policy if exists "Anyone can read post likes" on public.post_likes;
drop policy if exists "Users can toggle post likes" on public.post_likes;
drop policy if exists "Users can remove post likes" on public.post_likes;

create policy "Anyone can read post likes" on public.post_likes for select using (true);
create policy "Users can toggle post likes" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "Users can remove post likes" on public.post_likes for delete using (auth.uid() = user_id);

-- Note on comments: The comments table already exists, but lacks UPDATE/DELETE. We need to let users delete their own comments so they "stay forever until manually deleted" vs failing to delete or save.
drop policy if exists "Users can update their own comments." on public.comments;
drop policy if exists "Users can delete their own comments." on public.comments;

create policy "Users can update their own comments." on public.comments for update using (auth.uid() = user_id);
create policy "Users can delete their own comments." on public.comments for delete using (auth.uid() = user_id);
