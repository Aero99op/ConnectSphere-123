UPDATE public.profiles
SET role = 'official', 
    department = 'Civic Works', 
    assigned_area = 'Sector 4'
FROM auth.users
WHERE profiles.id = auth.users.id 
AND auth.users.email = 'guest@connectsphere.com';
