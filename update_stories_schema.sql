-- Story Interactions Schema

-- 1. Story Likes
create table if not exists public.story_likes (
    id uuid default gen_random_uuid() primary key,
    story_id uuid references public.stories(id) on delete cascade not null,
    user_id uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(story_id, user_id)
);

-- 2. Story Comments (Replies)
create table if not exists public.story_comments (
    id uuid default gen_random_uuid() primary key,
    story_id uuid references public.stories(id) on delete cascade not null,
    user_id uuid references public.profiles(id) not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Story Views (Tracking)
create table if not exists public.story_views (
    id uuid default gen_random_uuid() primary key,
    story_id uuid references public.stories(id) on delete cascade not null,
    viewer_id uuid references public.profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(story_id, viewer_id)
);

-- Enable RLS
alter table public.story_likes enable row level security;
alter table public.story_comments enable row level security;
alter table public.story_views enable row level security;

-- Policies
-- Likes
create policy "Anyone can read story likes" on public.story_likes for select using (true);
create policy "Users can toggle likes" on public.story_likes for insert with check (auth.uid() = user_id);
create policy "Users can remove likes" on public.story_likes for delete using (auth.uid() = user_id);

-- Comments
create policy "Anyone can read story comments" on public.story_comments for select using (true);
create policy "Users can comment" on public.story_comments for insert with check (auth.uid() = user_id);

-- Views
create policy "Users can record views" on public.story_views for insert with check (auth.uid() = viewer_id);
create policy "Users can see who viewed their story" on public.story_views for select using (
    exists (select 1 from public.stories where id = story_views.story_id and user_id = auth.uid())
);
