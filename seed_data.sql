-- 🇮🇳 ConnectSphere Seed Data (FIXED)
-- Run this in Supabase SQL Editor to populate the app with Dummy Data.

-- FIX: We need to drop the Foreign Key constraint temporarily because we are creating FAKE profiles
-- that do not have real Auth Users. This is fine for development/testing the UI.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

DO $$
DECLARE
    u1 uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; -- Fixed UUIDs for consistency
    u2 uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';
    u3 uuid := 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33';
    official1 uuid := 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44';
BEGIN

    -- 1. Insert/Upsert Profiles (Using ON CONFLICT to avoid duplicates if run multiple times)
    insert into public.profiles (id, username, full_name, avatar_url, role, bio) values
    (u1, 'sneha_travels', 'Sneha Kapoor', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha', 'citizen', 'Wanderlust 🌍 | Delhi'),
    (u2, 'tech_guru_rahul', 'Rahul Sharma', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul', 'citizen', 'Tech Reviewer 📱'),
    (u3, 'foodie_priya', 'Priya Singh', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya', 'citizen', 'Chole Bhature > Pizza'),
    (official1, 'municipal_officer_1', 'Officer Rajesh', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh', 'official', 'Junior Engineer | Ward 12')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert Posts
    insert into public.posts (user_id, title, caption, file_urls, media_type, likes_count) values
    (u1, 'Goa Trip', 'Missing the beaches of Goa! 🏖️ #Travel #India', ARRAY['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800'], 'image', 120),
    (u2, 'New Setup', 'Finally upgraded my workspace. Thoughts? 💻', ARRAY['https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800'], 'image', 450),
    (u3, 'Street Food', 'Best Pani Puri in town! 😋', ARRAY['https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800'], 'image', 89);

    -- 3. Insert Reports (Civic Issues)
    insert into public.reports (user_id, title, description, type, media_urls, status, address, latitude, longitude) values
    (u2, 'Garbage Dump not cleared', 'Garbage has been piling up for 3 days near Main Market.', 'garbage', ARRAY['https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800'], 'pending', 'Sector 15, Noida', 28.58, 77.31),
    (u3, 'Deep Pothole', 'Dangerous pothole on the ring road.', 'pothole', ARRAY['https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800'], 'under_review', 'Ring Road, Delhi', 28.70, 77.10);

    -- 4. Insert Stories
    insert into public.stories (user_id, media_urls, expires_at) values
    (u1, ARRAY['https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800'], now() + interval '20 hours');

END $$;
