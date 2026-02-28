-- 🚀 ConnectSphere Final Persistence Fix (Run this in Supabase SQL Editor)

-- 1. Post Likes Table
create table if not exists public.post_likes (
    id uuid default gen_random_uuid() primary key,
    post_id uuid references public.posts(id) on delete cascade not null,
    user_id uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(post_id, user_id)
);

-- 2. Story Likes Table
create table if not exists public.story_likes (
    id uuid default gen_random_uuid() primary key,
    story_id uuid references public.stories(id) on delete cascade not null,
    user_id uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(story_id, user_id)
);

-- 3. Story Comments Table
create table if not exists public.story_comments (
    id uuid default gen_random_uuid() primary key,
    story_id uuid references public.stories(id) on delete cascade not null,
    user_id uuid references public.profiles(id) not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Enable RLS
alter table public.post_likes enable row level security;
alter table public.story_likes enable row level security;
alter table public.story_comments enable row level security;
alter table public.comments enable row level security;

-- 5. Policies (Drop first for idempotency)
drop policy if exists "Public post likes" on public.post_likes;
drop policy if exists "Users can toggle post likes" on public.post_likes;
drop policy if exists "Users can remove post likes" on public.post_likes;

create policy "Public post likes" on public.post_likes for select using (true);
create policy "Users can toggle post likes" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "Users can remove post likes" on public.post_likes for delete using (auth.uid() = user_id);

drop policy if exists "Public story likes" on public.story_likes;
drop policy if exists "Users can like stories" on public.story_likes;
drop policy if exists "Users can unlike stories" on public.story_likes;

create policy "Public story likes" on public.story_likes for select using (true);
create policy "Users can like stories" on public.story_likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike stories" on public.story_likes for delete using (auth.uid() = user_id);

drop policy if exists "Public story comments" on public.story_comments;
drop policy if exists "Users can comment on stories" on public.story_comments;

create policy "Public story comments" on public.story_comments for select using (true);
create policy "Users can comment on stories" on public.story_comments for insert with check (auth.uid() = user_id);

-- Fix Comments Table Policies
drop policy if exists "Users can insert their own comments." on public.comments;
create policy "Users can insert their own comments." on public.comments for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments." on public.comments;
create policy "Users can delete their own comments." on public.comments for delete using (auth.uid() = user_id);
