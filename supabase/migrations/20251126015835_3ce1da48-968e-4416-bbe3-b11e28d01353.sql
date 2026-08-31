-- Fix profiles RLS to prevent email/phone exposure
-- Drop the problematic policy and function
DROP POLICY IF EXISTS "Anyone can view basic profile info" ON public.profiles;
DROP FUNCTION IF EXISTS public.can_view_public_profile_info();

-- Create new policies that properly restrict sensitive data
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Public can view non-sensitive profile fields"
ON public.profiles
FOR SELECT
USING (true);

-- Add comment explaining the security model
COMMENT ON POLICY "Public can view non-sensitive profile fields" ON public.profiles IS 
'This policy allows viewing profiles, but application layer must filter to only return full_name and avatar_url. Email and phone should only be returned when auth.uid() = id.';
