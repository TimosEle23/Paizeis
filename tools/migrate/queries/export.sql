-- Full export of the Lovable Cloud (Supabase) database as a single JSON value.
--
-- Run this in Lovable → Cloud → SQL editor, then save the single result cell to
-- tools/migrate/data/export.json.
--
-- Lovable Cloud exposes no Postgres connection string, so this replaces a live
-- connection. The data is small (a few hundred rows), so one blob is simpler and
-- more repeatable than a dozen separate exports.
--
-- auth.users is included because encrypted_password lives there and is not
-- reachable over the REST API — it is the reason existing users keep their
-- logins instead of being forced to reset.

select jsonb_build_object(
  'exported_at', now(),

  'users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select id, email, encrypted_password, created_at, updated_at,
           email_confirmed_at, last_sign_in_at,
           raw_user_meta_data, raw_app_meta_data
    from auth.users) t),

  'profiles',            (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from profiles t),
  'user_roles',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from user_roles t),
  'venues',              (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from venues t),
  'pitches',             (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from pitches t),
  'venue_managers',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from venue_managers t),
  'teams',               (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from teams t),
  'team_roster',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from team_roster t),
  'team_members',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from team_members t),
  'bookings',            (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from bookings t),
  'player_stats',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from player_stats t),
  'match_stats',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from match_stats t),
  'player_listings',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from player_listings t),
  'substitute_players',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from substitute_players t),
  'tournaments',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from tournaments t),
  'tournament_teams',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from tournament_teams t),
  'tournament_matches',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from tournament_matches t),
  'email_invitations',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from email_invitations t)
) as export;
