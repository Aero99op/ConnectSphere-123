-- 🇮🇳 ConnectSphere Profile Sync Script
-- This script ensures all auth.users have a corresponding entry in public.profiles.
-- Run this if you see "Key is not present in table profiles" errors.

INSERT INTO public.profiles (id, username, full_name, role)
SELECT 
    id, 
    COALESCE(auth.users.raw_user_meta_data->>'username', split_part(email, '@', 1)),
    COALESCE(auth.users.raw_user_meta_data->>'full_name', 'ConnectSphere User'),
    COALESCE(auth.users.raw_user_meta_data->>'role', 'citizen')
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.users.id
)
ON CONFLICT (id) DO NOTHING;

-- Also verify the trigger is correctly set for future signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
