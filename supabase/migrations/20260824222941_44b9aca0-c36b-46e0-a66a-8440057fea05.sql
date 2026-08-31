
-- 1. Dedicated venue-images bucket policies
create policy "Admins can read venue images"
on storage.objects for select to authenticated
using (bucket_id = 'venue-images' and private.has_role(auth.uid(), 'admin'::app_role));

create policy "Anyone can read venue image files"
on storage.objects for select to anon
using (
  bucket_id = 'venue-images'
  and lower(storage.extension(name)) = any (array['png','jpg','jpeg','gif','webp','avif'])
);

create policy "Admins can upload venue images to venue bucket"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'venue-images'
  and owner = auth.uid()
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = auth.uid()::text
  and private.has_role(auth.uid(), 'admin'::app_role)
);

create policy "Admins can update venue images in venue bucket"
on storage.objects for update to authenticated
using (
  bucket_id = 'venue-images'
  and owner = auth.uid()
  and private.has_role(auth.uid(), 'admin'::app_role)
)
with check (
  bucket_id = 'venue-images'
  and owner = auth.uid()
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = auth.uid()::text
  and private.has_role(auth.uid(), 'admin'::app_role)
);

create policy "Admins can delete venue images in venue bucket"
on storage.objects for delete to authenticated
using (
  bucket_id = 'venue-images'
  and private.has_role(auth.uid(), 'admin'::app_role)
);

-- Stop new writes into the shared avatars bucket venues/ folder
drop policy if exists "Admins can upload venue images" on storage.objects;
drop policy if exists "Admins can update venue images" on storage.objects;

-- 2. Explicit admin-only policies for the private export bucket
create policy "Admins can read database exports"
on storage.objects for select to authenticated
using (bucket_id = 'database_export_03_08_26' and private.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can write database exports"
on storage.objects for insert to authenticated
with check (bucket_id = 'database_export_03_08_26' and private.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can update database exports"
on storage.objects for update to authenticated
using (bucket_id = 'database_export_03_08_26' and private.has_role(auth.uid(), 'admin'::app_role))
with check (bucket_id = 'database_export_03_08_26' and private.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can delete database exports"
on storage.objects for delete to authenticated
using (bucket_id = 'database_export_03_08_26' and private.has_role(auth.uid(), 'admin'::app_role));

-- 3. Validate invitation references belong to the inviter
create or replace function private.can_invite_reference(
  _user_id uuid, _team_id uuid, _booking_id uuid, _tournament_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (_user_id is not null)
    and (
      _team_id is null or exists (
        select 1 from public.teams t
        where t.id = _team_id
          and (t.captain_id = _user_id
               or exists (select 1 from public.team_members m
                          where m.team_id = t.id and m.user_id = _user_id))
      )
    )
    and (
      _booking_id is null or exists (
        select 1 from public.bookings b
        where b.id = _booking_id
          and (b.user_id = _user_id
               or exists (select 1 from public.teams t
                          where t.id = b.team_id and t.captain_id = _user_id))
      )
    )
    and (
      _tournament_id is null or exists (
        select 1 from public.tournaments tr where tr.id = _tournament_id
      )
    )
$$;

revoke all on function private.can_invite_reference(uuid, uuid, uuid, uuid) from public;
revoke all on function private.can_invite_reference(uuid, uuid, uuid, uuid) from anon;
revoke all on function private.can_invite_reference(uuid, uuid, uuid, uuid) from authenticated;

drop policy if exists "Authenticated users can create invitations" on public.email_invitations;
create policy "Authenticated users can create invitations"
on public.email_invitations for insert to authenticated
with check (
  auth.uid() = invited_by
  and private.can_invite_reference(auth.uid(), team_id, booking_id, tournament_id)
);

drop policy if exists "Inviters can update their own invitations" on public.email_invitations;
create policy "Inviters can update their own invitations"
on public.email_invitations for update to authenticated
using (auth.uid() = invited_by)
with check (
  auth.uid() = invited_by
  and private.can_invite_reference(auth.uid(), team_id, booking_id, tournament_id)
);
