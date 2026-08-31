DROP POLICY IF EXISTS "Admins can manage venue images" ON storage.objects;

CREATE POLICY "Admins can upload venue images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND array_length(storage.foldername(name), 1) = 2
  AND (storage.foldername(name))[2] = (auth.uid())::text
  AND owner = auth.uid()
  AND private.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update venue images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND private.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND array_length(storage.foldername(name), 1) = 2
  AND (storage.foldername(name))[2] = (auth.uid())::text
  AND owner = auth.uid()
  AND private.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete venue images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND private.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can view relevant invitations" ON public.email_invitations;

CREATE POLICY "Users can view relevant invitations"
ON public.email_invitations FOR SELECT TO authenticated
USING (
  auth.uid() = invited_by
  OR (
    auth.email() IS NOT NULL
    AND lower(auth.email()) = lower(email)
    AND coalesce(((auth.jwt() -> 'user_metadata') ->> 'email_verified')::boolean, false) = true
  )
);