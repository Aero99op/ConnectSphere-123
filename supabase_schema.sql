-- 🇮🇳 ConnectSphere Database Schema (Full V2)

-- 1. Profiles Table (Public User Info + Roles)
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  full_name text,
  avatar_url text,
  bio text default 'Just another Desi on ConnectSphere',
  karma_points int default 0,
  -- Civic Reporting Fields
  role text check (role in ('citizen', 'official', 'admin')) default 'citizen',
  department text, -- e.g., 'Sanitation', 'Roads' (Only for officials)
  assigned_area text, -- e.g., 'Indiranagar', 'Koramangala'
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Posts Table (The Feed)
create table public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text,
  caption text,
  file_urls text[] not null,
  thumbnail_url text,
  media_type text check (media_type in ('image', 'video')),
  likes_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Comments Table (Baatcheet)
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Stories Table (Kisse - 24h Expiry)
create table public.stories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  media_url text not null,
  media_type text check (media_type in ('image', 'video')) default 'image',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  expires_at timestamp with time zone default timezone('utc'::text, now() + interval '24 hours')
);

-- 5. Notifications Table (Suchna)
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  recipient_id uuid references public.profiles(id) not null,
  actor_id uuid references public.profiles(id) not null,
  type text check (type in ('like', 'comment', 'follow', 'mention', 'report_update')),
  entity_id uuid, 
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Bookmarks Table (Saved Posts)
create table public.bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, post_id)
);

-- 7. Follows Table (Dostana)
create table public.follows (
  follower_id uuid references public.profiles(id) not null,
  following_id uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (follower_id, following_id)
);

-- 8. Civic Reports Table (Janata Ki Awaaz)
create table public.reports (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) not null,
    title text not null, -- e.g., "Pothole on Main Road"
    description text,
    type text not null, -- 'pothole', 'garbage', 'water', 'electricity', 'other'
    media_urls text[], -- Evidence
    latitude float,
    longitude float,
    address text,
    status text check (status in ('pending', 'under_review', 'accepted', 'working', 'completed', 'rejected')) default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 9. Report Updates (Action Taken by Dept)
create table public.report_updates (
    id uuid default gen_random_uuid() primary key,
    report_id uuid references public.reports(id) on delete cascade not null,
    official_id uuid references public.profiles(id) not null,
    previous_status text,
    new_status text not null,
    description text, -- "Crew dispatched" or "Fixed"
    media_urls text[], -- Proof of work
    latitude float, -- Geo-proof
    longitude float,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 10. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.notifications enable row level security;
alter table public.bookmarks enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;
alter table public.report_updates enable row level security;

-- 11. Policies
-- Public Read
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Public posts are viewable by everyone." on public.posts for select using (true);
create policy "Public comments are viewable by everyone." on public.comments for select using (true);
create policy "Public stories are viewable by everyone." on public.stories for select using (expires_at > now());
create policy "Public follows are viewable by everyone." on public.follows for select using (true);
create policy "Public reports are viewable by everyone." on public.reports for select using (true);
create policy "Public report updates are viewable by everyone." on public.report_updates for select using (true);

-- User Write (Citizen)
create policy "Users can insert their own posts." on public.posts for insert with check (auth.uid() = user_id);
create policy "Users can insert their own comments." on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can insert their own stories." on public.stories for insert with check (auth.uid() = user_id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);
create policy "Users can create reports." on public.reports for insert with check (auth.uid() = user_id);

-- Notifications (Private)
create policy "Users can view receive notifications." on public.notifications for select using (auth.uid() = recipient_id);

-- Bookmarks (Private)
create policy "Users can view their own bookmarks." on public.bookmarks for select using (auth.uid() = user_id);
create policy "Users can insert their own bookmarks." on public.bookmarks for insert with check (auth.uid() = user_id);

-- Follows
create policy "Users can follow others." on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow others." on public.follows for delete using (auth.uid() = follower_id);

-- Official Write Access (Strict)
-- Only officials can insert report updates (This logic is usually handled in API middleware or trigger, but for simplicity via RLS using profile lookup)
create policy "Officials can update reports." on public.report_updates for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'official')
);

-- 12. Trigger for New User
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 
          coalesce(new.raw_user_meta_data->>'role', 'citizen')); -- Default to Citizen
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 13. Karma Function
create or replace function increment_karma(user_id_param uuid)
returns void as $$
begin
  update public.profiles
  set karma_points = karma_points + 1
  where id = user_id_param;
end;
$$ language plpgsql security definer;
