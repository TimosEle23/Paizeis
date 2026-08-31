
-- 1. Avatars bucket: strict ownership + path structure
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND owner = auth.uid()
  AND array_length(storage.foldername(name), 1) = 1
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND owner = auth.uid()
  AND array_length(storage.foldername(name), 1) = 1
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Venue images live under venues/ and are admin-managed only
CREATE POLICY "Admins can manage venue images"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND private.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND private.has_role(auth.uid(), 'admin')
);

-- 2. rate_limit_attempts: writes only via service role
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.rate_limit_attempts FROM anon, authenticated;
REVOKE ALL ON public.rate_limit_attempts FROM anon;
GRANT SELECT ON public.rate_limit_attempts TO authenticated;
GRANT ALL ON public.rate_limit_attempts TO service_role;

CREATE POLICY "No client writes to rate limit attempts"
ON public.rate_limit_attempts AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

COMMENT ON TABLE public.rate_limit_attempts IS 'Rate limiting log. Writes are performed exclusively by edge functions using the service role; client roles are denied by a restrictive policy and revoked grants. Admins may read for monitoring.';
