-- Drop redundant/misleading SELECT policies on profiles table
DROP POLICY IF EXISTS "Search profiles by exact email for team invitations" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;

-- Create a single, clear SELECT policy for users viewing their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Keep the existing admin policy (already exists: "Admins can view all profiles")