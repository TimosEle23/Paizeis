-- 1. Remove anonymous read access to the private venue-images bucket.
-- Venue images are served through signed URLs, which bypass RLS.
drop policy if exists "Anyone can read venue image files" on storage.objects;

-- 2. Admin updates should depend on the admin role only, not on file ownership.
drop policy if exists "Admins can update venue images in venue bucket" on storage.objects;
create policy "Admins can update venue images in venue bucket"
on storage.objects for update to authenticated
using (
  bucket_id = 'venue-images'
  and private.has_role(auth.uid(), 'admin'::app_role)
)
with check (
  bucket_id = 'venue-images'
  and private.has_role(auth.uid(), 'admin'::app_role)
  and lower(storage.extension(name)) = any (array['png','jpg','jpeg','gif','webp','avif'])
);