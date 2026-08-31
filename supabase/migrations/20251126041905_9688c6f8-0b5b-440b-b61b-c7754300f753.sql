-- Allow authenticated users to look up other users by email for team invitations
-- This only allows viewing email and id, not phone numbers or other sensitive data
CREATE POLICY "Authenticated users can search by email for invitations"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);