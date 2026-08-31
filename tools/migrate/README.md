# Supabase → MongoDB migration

One-shot, idempotent, and rehearsed against a scratch database before it is ever
pointed at production.

## Order

Foreign keys dictate it:

```
users → venues (+pitches) → teams (+roster) → bookings → pitchBlocks
      → invitations → playerStats → matchStats → listings → tournaments
```

## Decisions this script encodes

- **UUID → ObjectId** through a persisted `.idmap.json`, so a rerun maps the
  same source row to the same document instead of duplicating it.
- **Passwords carry over.** Supabase keeps bcrypt hashes in
  `auth.users.encrypted_password`, readable over the direct Postgres connection
  and verifiable by `bcryptjs`. Nobody has to reset. Confirm this column is
  reachable in Phase 1 — the fallback (a forced reset email to every user) is a
  decision to take early, not on cutover day.
- **`booking_date` + `"HH:MM"` → UTC `startsAt`/`endsAt`**, reading the originals
  as `Europe/Nicosia` wall-clock time.
- **`status: "blocked"` bookings → `pitchBlocks`.** The old app stored
  maintenance windows as fake bookings with `team_id` set to the pitch id.
- **`profiles` + `auth.users` → one `users` collection.**
- **`team_roster` → `roster[]` embedded in the team**; `member_count` is dropped
  and derived.

## Running it

```sh
cp .env.example .env     # SUPABASE_DB_URL + MONGODB_URI (point at a scratch DB first)
npm run migrate --workspace @paizeis/migrate
npm run verify --workspace @paizeis/migrate   # counts + spot checks against the source
```
