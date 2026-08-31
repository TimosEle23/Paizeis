# Authorization

The Supabase backend enforced access with row-level security. MongoDB has no
equivalent, so every rule becomes an explicit server-side check. This document
is the map between the two, and it is the definition of "the migration is
complete" — until every row here has a predicate and a test, it isn't.

## What was actually there

| | count |
|---|---|
| `CREATE POLICY` statements across all migrations | 160 |
| distinct `(table, policy)` pairs after replacements | **107** |
| tables covered | 22 |

The gap between 160 and 107 is iteration: policies dropped and recreated as the
rules were refined. 107 is the real surface.

Of those 107, three groups do not need porting:

| group | policies | why not |
|---|---|---|
| `storage.*` | 17 | Supabase Storage is replaced by Cloudflare R2 with presigned, expiring upload URLs — a different mechanism, not a rule to translate |
| `clients`, `deals`, `invoices` | 15 | dead Lovable CRM template, all three tables empty, not migrated |
| `rate_limit_attempts` | 2 | replaced by `express-rate-limit` in `middleware/rateLimit.ts` |

**That leaves 73 policies to express as code.**

## Roles

| Role | Source of truth | Granted by |
|---|---|---|
| `user` | every account | registration |
| `venueManager` | a row in `venueManagers` | an admin, per venue |
| `admin` | `roles: ["admin"]` on the user | another admin |

Venue-manager authority is **per venue**, not global. The old
`venue_managers` policies encoded this by joining on `venue_id`; the equivalent
here is `managesVenue(actor, venueId)`, and flattening it into a global role
would silently hand one venue's manager authority over all 52.

## Conventions

- **Every service method takes the actor first**: `getBooking(actor, id)`. No
  actor, no data. This is the convention that replaces "the database checks it".
- **Controllers never query the database directly.** They call a service.
- **404 over 403** for resources the actor should not learn exist. A 403 on
  "venue 5's bookings" confirms venue 5 has bookings; a 404 confirms nothing.
  `ApiError.forbidden()` is for cases where the actor legitimately knows the
  resource is there — their own team, a venue they manage.

## Policy map

Predicates live in `src/modules/auth/policies.ts` and per-module `policies.ts`.

### Done — Phase 2

| Collection | Old rule | Predicate | Test |
|---|---|---|---|
| `users` | profiles: read own, update own | `isSelf` on `/me` routes | `auth.test.ts` → returns the caller's own profile |
| `users` | profiles: insert own | registration only, id from the token | `auth.test.ts` → registration |
| `users` | — | account deletion is self-only | `auth.test.ts` → deletes the account |
| `user_roles` | read own roles; only admins write | roles are claims in the access token; no write route exists | `auth.test.ts` → roles on registration |
| `sessions` | (new) | refresh tokens stored hashed, revoked on rotation | `auth.test.ts` → rotation, replay, sign-out |

### Outstanding — Phase 3

| Collection | Old rule | Predicate | Status |
|---|---|---|---|
| `venues` | public read; admin write | public `GET`; `requireRole("admin")` | to build |
| `pitches` | public read; admin + venue manager write | `assertManagesVenue` | to build |
| `bookings` | read own; venue managers read their venue's; insert own; update own or venue manager's | `canViewBooking`, `canModifyBooking` | to build |
| `teams` | read if member; update if captain | `isRosterMember`, `isTeamCaptain` | to build |
| `team_roster` | read if member; captain manages | `isTeamCaptain` | to build |
| `team_members` | folded into the embedded roster | same predicates as `teams` | to build |
| `player_stats` | read own; system writes | `isSelf` | to build |
| `match_stats` | read own and teammates' | `isRosterMember` on the booking's team | to build |
| `player_listings` | public read when active; write own | `isSelf` | to build |
| `substitute_players` | read own team's; insert own | `isRosterMember` | to build |
| `email_invitations` | read if inviter or invitee; insert own | `isInviterOrInvitee` | to build |
| `tournaments` | public read; admin write | public `GET`; `requireRole("admin")` | to build |
| `tournament_teams` | read public; captain enters own team | `isTeamCaptain` | to build |
| `tournament_matches` | public read; admin write | `requireRole("admin")` | to build |
| `venue_managers` | admin manages; manager reads own | `requireRole("admin")`, `isSelf` | to build |

## Acceptance suite

Modelled on `supabase/functions/rls-selftest/index.ts`, which did the same job
against RLS: for **every owned resource, a signed-in non-owner must get 403 or
404**. One test per row of the tables above. A permission that has no test is
a permission nobody has checked.
