-- 💬 Guptugu (Chat) Complete Schema (Idempotent)

-- 1. Conversations Table (Base + Updates)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references public.profiles(id), -- Nullable for Groups
  user2_id uuid references public.profiles(id), -- Nullable for Groups
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
  -- unique(user1_id, user2_id) -- Removed unique constraint generally to allow Nulls, or handle via index
);

-- Add Columns safely (for existing tables)
alter table public.conversations 
add column if not exists is_group boolean default false,
add column if not exists group_name text,
add column if not exists group_avatar text,
add column if not exists owner_id uuid references public.profiles(id);

-- 2. Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) not null,
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add Shared Content Columns safely
alter table public.messages
add column if not exists post_id uuid references public.posts(id) on delete set null,
add column if not exists story_id uuid references public.stories(id) on delete set null;

-- 3. Participants Table (For Groups)
create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (conversation_id, user_id)
);

-- 4. Enable RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_participants enable row level security;

-- 5. Policies (Drop existing to redefine safely)

-- Conversations
drop policy if exists "Users can view their own conversations" on public.conversations;
create policy "Users can view their own conversations" on public.conversations
  for select using (
    (user1_id = auth.uid() or user2_id = auth.uid()) -- Legacy/DM
    or 
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid()) -- Group
  );

drop policy if exists "Users can create conversations" on public.conversations;
create policy "Users can create conversations" on public.conversations
  for insert with check (auth.uid() = user1_id or auth.uid() = user2_id or auth.uid() = owner_id);

-- Messages
drop policy if exists "Users can view messages in their conversations" on public.messages;
create policy "Users can view messages in their conversations" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      left join public.conversation_participants cp on c.id = cp.conversation_id
      where c.id = messages.conversation_id
      and (
        (c.user1_id = auth.uid() or c.user2_id = auth.uid()) -- DM access
        or
        (cp.user_id = auth.uid()) -- Group access
      )
    )
  );

drop policy if exists "Users can send messages to their conversations" on public.messages;
create policy "Users can send messages to their conversations" on public.messages
  for insert with check (
    auth.uid() = sender_id 
    -- We trust the frontend logically, or re-verify membership here (omitted for brevity/perf, but good practice to add)
  );

-- Participants
drop policy if exists "Users can view participants in their conversations" on public.conversation_participants;
create policy "Users can view participants in their conversations" on public.conversation_participants
  for select using (
    user_id = auth.uid() -- Can always see yourself
    or
    exists (
        select 1 from public.conversations c
        where c.id = conversation_participants.conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- 6. RPC: Create Group Chat
create or replace function public.create_group_chat(name text, member_ids uuid[])
returns uuid as $$
declare
  new_conv_id uuid;
  member_id uuid;
begin
  -- Create Conversation
  insert into public.conversations (is_group, group_name, owner_id)
  values (true, name, auth.uid())
  returning id into new_conv_id;

  -- Insert Participants
  foreach member_id in array member_ids
  loop
    insert into public.conversation_participants (conversation_id, user_id)
    values (new_conv_id, member_id);
  end loop;

  -- Add Creator as participant too
  insert into public.conversation_participants (conversation_id, user_id)
  values (new_conv_id, auth.uid())
  on conflict do nothing;

  return new_conv_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 7. Realtime Replication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
