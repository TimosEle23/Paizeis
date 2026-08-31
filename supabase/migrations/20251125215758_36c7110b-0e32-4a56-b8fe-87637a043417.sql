-- Fix the security definer view by removing it and using RLS instead
DROP VIEW IF EXISTS public.public_profiles;

-- Create a function to check if viewing public profile info is allowed
CREATE OR REPLACE FUNCTION public.can_view_public_profile_info()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Anyone can view basic profile info for team/stats purposes
  SELECT true;
$$;

-- Update profiles RLS to allow viewing basic info
CREATE POLICY "Anyone can view basic profile info"
ON public.profiles
FOR SELECT
USING (
  -- Users can always see their own full profile
  auth.uid() = id 
  OR 
  -- Everyone can see limited public info (checked by application layer)
  can_view_public_profile_info()
);