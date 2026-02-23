-- 1. Profiles (Public User Info)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  full_name text,
  avatar_url text,
  bio text default 'Just another Desi on ConnectSphere',
  karma_points int default 0,
  role text check (role in ('citizen', 'official', 'admin')) default 'citizen',
  department text,
  assigned_area text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Conversations (The logical container for chat)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references public.profiles(id) on delete set null,
  user2_id uuid references public.profiles(id) on delete set null,
  is_group boolean default false,
  group_name text,
  group_avatar text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Conversation Participants (For Group Chats)
create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (conversation_id, user_id)
);

-- 4. Messages (Hardened Version)
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null, -- Nullable to keep message history if user leaves
  content text,
  file_urls text[] default '{}',
  file_name text,
  file_size integer,
  thumbnail_url text,
  post_id uuid references public.posts(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes for RAW-Level Speed
create index if not exists idx_messages_conv_id on public.messages(conversation_id);
create index if not exists idx_posts_user_id on public.posts(user_id);
create index if not exists idx_stories_user_id on public.stories(user_id);

-- ... (Rest of tables keep same structure but add cascades)
-- 5. Posts (The Feed)
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  caption text,
  file_urls text[] not null default '{}',
  thumbnail_url text,
  media_type text check (media_type in ('image', 'video')),
  likes_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Comments (Baatcheet)
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ... (Existing stories, reports, audit_logs tables)

-- 7. Stories (Kisse)
create table if not exists public.stories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  media_urls text[] not null default '{}', -- Changed to array for consistency
  media_type text check (media_type in ('image', 'video')) default 'image',
  thumbnail_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  expires_at timestamp with time zone default timezone('utc'::text, now() + interval '24 hours')
);

-- 8. Civic Reports (Janata Ki Awaaz)
create table if not exists public.reports (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) not null,
    title text not null,
    description text,
    type text not null,
    media_urls text[], 
    latitude float,
    longitude float,
    address text,
    status text check (status in ('pending', 'under_review', 'accepted', 'working', 'completed', 'rejected')) default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 9. Audit Logs (Security Hardening)
-- Tracks Catbox URL exposure for governance (since Catbox is public-facing)
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  action text not null, -- e.g., 'CHUNK_UPLOAD_COMPLETE'
  media_urls text[],
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- 10. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- 11. SECURITY POLICIES (Hardened & Idempotent)

-- Profiles
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles" on public.profiles for select using (true);

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles for update using (auth.uid() = id);

-- Conversations: Only participants can see the conversation record
drop policy if exists "Conversations: Participant View" on public.conversations;
create policy "Conversations: Participant View" on public.conversations
  for select using (
    auth.uid() = user1_id or 
    auth.uid() = user2_id or 
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid())
  );

-- Messages: CRITICAL FIX - Allow both parties to see messages
drop policy if exists "Messages: Participant View" on public.messages;
create policy "Messages: Participant View" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
      and (
        c.user1_id = auth.uid() or 
        c.user2_id = auth.uid() or 
        exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.user_id = auth.uid())
      )
    )
  );

-- Social: Public read, owner write
drop policy if exists "Public read posts" on public.posts;
create policy "Public read posts" on public.posts for select using (true);

drop policy if exists "Insert own posts" on public.posts;
create policy "Insert own posts" on public.posts for insert with check (auth.uid() = user_id);

drop policy if exists "Public read stories" on public.stories;
create policy "Public read stories" on public.stories for select using (expires_at > now());

drop policy if exists "Insert own stories" on public.stories;
create policy "Insert own stories" on public.stories for insert with check (auth.uid() = user_id);

-- Audit Logs: Private only
drop policy if exists "Private audit logs" on public.audit_logs;
create policy "Private audit logs" on public.audit_logs for select using (auth.uid() = user_id);

drop policy if exists "Insert audit logs" on public.audit_logs;
create policy "Insert audit logs" on public.audit_logs for insert with check (auth.uid() = user_id);

-- 12. TRIGGERS & FUNCTIONS
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'citizen');
  return new;
end;
$$ language plpgsql security definer;

-- 13. REALTIME REPLICATION
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.messages, public.posts, public.stories;
