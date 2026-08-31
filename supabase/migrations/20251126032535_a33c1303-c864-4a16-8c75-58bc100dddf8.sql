-- Drop the overly permissive policy that exposes all user data
DROP POLICY IF EXISTS "Public can view non-sensitive profile fields" ON public.profiles;

-- The remaining policies already provide proper protection:
-- - "Users can view own profile" allows users to see their own data
-- - "Users can view their own full profile" is a duplicate that also protects data
-- This ensures emails and phone numbers are only visible to the profile owner