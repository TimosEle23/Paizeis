
-- 1. Avatars bucket: restrict public read to image files only
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND lower(storage.extension(name)) IN ('png','jpg','jpeg','gif','webp','svg','avif')
);

-- 2. email_invitations: explicit UPDATE policy scoped to the inviter
DROP POLICY IF EXISTS "Inviters can update their own invitations" ON public.email_invitations;
CREATE POLICY "Inviters can update their own invitations"
ON public.email_invitations FOR UPDATE
TO authenticated
USING (auth.uid() = invited_by)
WITH CHECK (auth.uid() = invited_by);

-- 3. Harden private helper functions
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$function$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_team_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.shares_team(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_team(uuid, uuid) TO authenticated, service_role;
