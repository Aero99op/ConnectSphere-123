-- Fix Notifications RLS: Add missing INSERT and UPDATE policies

-- 1. Insert Policy: Users can create notifications where they are the actor
create policy "Users can insert notifications" on public.notifications 
for insert 
with check (auth.uid() = actor_id);

-- 2. Update Policy: Users can update notifications they received (e.g. mark as read)
create policy "Users can update their own received notifications" on public.notifications 
for update 
using (auth.uid() = recipient_id);
