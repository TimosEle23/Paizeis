DROP POLICY "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND lower(storage.extension(name)) = ANY (ARRAY['png','jpg','jpeg','gif','webp','avif'])
);

DROP POLICY "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND owner = auth.uid()
  AND array_length(storage.foldername(name), 1) = 1
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) = ANY (ARRAY['png','jpg','jpeg','gif','webp','avif'])
);

DROP POLICY "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND owner = auth.uid()
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND owner = auth.uid()
  AND array_length(storage.foldername(name), 1) = 1
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) = ANY (ARRAY['png','jpg','jpeg','gif','webp','avif'])
);