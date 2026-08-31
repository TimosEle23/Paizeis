CREATE OR REPLACE FUNCTION private.current_user_verified_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
$$;

REVOKE ALL ON FUNCTION private.current_user_verified_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_verified_email() TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view relevant invitations" ON public.email_invitations;

CREATE POLICY "Users can view relevant invitations"
ON public.email_invitations FOR SELECT TO authenticated
USING (
  auth.uid() = invited_by
  OR lower(email) = private.current_user_verified_email()
);