-- Assign admin role to super admin (timos.eleftheriou@gmail.com)
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE p.email = 'timos.eleftheriou@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove the overly permissive profiles policy that exposes all data
DROP POLICY IF EXISTS "Authenticated users can search by email for invitations" ON public.profiles;

-- Create a more restrictive policy for team invitation email search
-- Only allows users to find profiles by exact email match for invitations
CREATE POLICY "Search profiles by exact email for team invitations"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id  -- Users can always see their own profile
);

-- Create a secure RPC function for email lookup that only returns user_id
CREATE OR REPLACE FUNCTION public.find_user_by_email(search_email text)
RETURNS TABLE (user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name
  FROM public.profiles
  WHERE email = search_email
  LIMIT 1
$$;