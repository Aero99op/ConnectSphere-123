-- 🛡️ ConnectSphere Database Hardening Script

-- 1. Secure New User Trigger
-- Explicitly default to 'citizen' and IGNORE any role passed in raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url', 
    'citizen' -- CRITICAL: Always default to citizen, ignore injections
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Secure Profile Fields Trigger
-- Prevent users from updating restricted fields (role, karma_points) even if they bypass API logic
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Block changing restricted fields
  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'Role change is restricted to system administrators.';
  END IF;

  IF (NEW.karma_points IS DISTINCT FROM OLD.karma_points) THEN
    RAISE EXCEPTION 'Karma points can only be updated via official civic actions.';
  END IF;

  IF (NEW.id IS DISTINCT FROM OLD.id) OR (NEW.email IS DISTINCT FROM OLD.email) THEN
    RAISE EXCEPTION 'Primary identity fields (ID/Email) cannot be changed.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger to ensure it's active
DROP TRIGGER IF EXISTS protect_profile_update ON public.profiles;
CREATE TRIGGER protect_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.protect_profile_fields();

-- 3. Fix Function Search Paths (Security Best Practice)
ALTER FUNCTION public.increment_karma(uuid) SET search_path = public;
