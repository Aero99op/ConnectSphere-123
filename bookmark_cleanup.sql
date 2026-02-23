-- Function to Clear All Bookmarks for the calling user
create or replace function clear_all_bookmarks()
returns void as $$
begin
  delete from public.bookmarks
  where user_id = auth.uid();
end;
$$ language plpgsql security definer;
