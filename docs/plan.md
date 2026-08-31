# Paizeis — Native Apps (iOS + Android) on a MongoDB Backend

**Day 0: Tuesday, 25 August 2026.** This is the recorded start of the build. All phase dates below count from it.

---

## Context

`/Users/timele23/Downloads/Paizeis` is **Paizeis** (paizeiscy.com) — a Cyprus futsal/padel pitch-booking site built in Lovable: Vite + React 18 + TypeScript + Tailwind + shadcn/ui, with Supabase providing *everything* on the back end (Auth, Postgres, 160 RLS policies, Storage, 7 Deno edge functions). Every page talks to Supabase directly from the browser; there is no server of our own.

The goal is a real product on the App Store and Google Play, on infrastructure we own, with MongoDB as the database and free-tier services wherever possible — and a genuine client/server split instead of a browser holding database credentials.

Three things follow from that, and they are the whole shape of this plan:

1. **There is no backend to reuse.** RLS *is* the authorization layer today. MongoDB has no equivalent, so all 160 policies become explicit server-side guards. This is the single largest risk in the migration and the reason the API is built before anything else.
2. **The website and the app must share one backend.** Two datastores holding the same bookings would drift within a week. The Vite site keeps its exact look and swaps only its data layer.
3. **The booking engine is a prototype.** [Booking.tsx:148-175](src/pages/Booking.tsx#L148-L175) generates time slots from a hardcoded `unavailableHours = [11, 13, 16, 20]` and never consults the `bookings` table. Nothing prevents two people booking the same pitch at the same hour. Real availability is not a nice-to-have in the port; it is the port.

### Decisions locked in

| | |
|---|---|
| Mobile | React Native + **Expo** (expo-router), native build via EAS |
| Website | Migrates to the same API; Supabase retired at the end |
| V1 scope | Auth · Home · Venues + map · Booking · Teams · Profile |
| Auth | Own JWT in the API (email/password + Google + Apple) |

---

## What exists today (inventory)

**Data model** — 22 Postgres tables in [types.ts](src/integrations/supabase/types.ts):
`venues` · `pitches` · `bookings` · `teams` · `team_roster` · `team_members` · `profiles` · `user_roles` · `venue_managers` · `player_stats` · `match_stats` · `player_listings` · `substitute_players` · `tournaments` · `tournament_teams` · `tournament_matches` · `email_invitations` · `rate_limit_attempts` · and four CRM leftovers (`clients`, `deals`, `invoices`).

**Roles** — `user` / `venueManager` / `admin`, declared in [routeAccess.ts](src/routes/routeAccess.ts) and enforced client-side by [RequireAccess.tsx](src/components/RequireAccess.tsx), server-side by RLS.

**Third-party** — Google Maps JS ([VenuesMap.tsx](src/components/VenuesMap.tsx)) · Stripe test payment link ([Booking.tsx:394](src/pages/Booking.tsx#L394)) · Resend ([send-invitation](supabase/functions/send-invitation/index.ts)) · Supabase Storage buckets `avatars` + venue images · Lovable CDN for all hero videos/images (`src/assets/*.asset.json` → `/__l5e/assets-v1/...`).

**Reusable as-is** — [validationSchemas.ts](src/lib/validationSchemas.ts) (Zod, moves to `packages/shared` untouched) · [useLanguage.tsx](src/hooks/useLanguage.tsx) EN/EL strings · [tailwind.config.ts](tailwind.config.ts) design tokens · [cyprus_venues.csv](src/data/cyprus_venues.csv) + 25 venue images in [public/images/venues/](public/images/venues/).

### Defects to fix during the port, not after

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | [Booking.tsx:148](src/pages/Booking.tsx#L148) | Slots are fake; double-booking is possible | Server availability + transactional booking |
| 2 | [Booking.tsx:366](src/pages/Booking.tsx#L366) vs [:788](src/pages/Booking.tsx#L788) | Deposit stored at 15%, displayed as 20% | One server-side rate (20%), per-venue overridable |
| 3 | [Booking.tsx:394](src/pages/Booking.tsx#L394) | Hardcoded Stripe **test** link; amount not sent | Server-created Checkout Session with real amount |
| 4 | [MaintenanceBlocking.tsx:53-64](src/components/venue-admin/MaintenanceBlocking.tsx#L53-L64) | Blocks are fake bookings with `team_id = pitch_id` | Own `pitchBlocks` collection |
| 5 | `teams.member_count` | Denormalized, never resynced | Derived from roster |
| 6 | [Booking.tsx:156](src/pages/Booking.tsx#L156) | Opening hours hardcoded 09:00–21:00 for every venue | `openingHours` per venue |
| 7 | [rateLimit.ts](src/lib/rateLimit.ts) | localStorage rate limit — trivially bypassed | Server rate limit, Mongo-backed |

---

## Target architecture

```
paizeis/                                npm workspaces monorepo
├─ apps/
│  ├─ api/          Node 20 · Express · TypeScript · Mongoose      ← the only thing touching the DB
│  ├─ mobile/       Expo · React Native · expo-router              ← iOS + Android
│  └─ web/          existing Vite app, data layer swapped          ← same UI, new source
├─ packages/
│  ├─ shared/       Zod schemas + TS types + API contract          ← one definition, three consumers
│  └─ api-client/   typed fetch client (mobile + web import this)
└─ tools/migrate/   one-shot Supabase → MongoDB migration
```

**The rule that makes the split real:** `@supabase/supabase-js` and the Mongo driver appear in `apps/api` only. `apps/mobile` and `apps/web` may import `@paizeis/api-client` and nothing else for data. Enforce it with an ESLint `no-restricted-imports` rule so it cannot rot.

### Free-tier service stack

| Need | Service | Free tier | Note |
|---|---|---|---|
| Database | **MongoDB Atlas M0** | 512 MB, forever | Replica set → transactions available (needed for booking) |
| API hosting | **Render** free web service | 750 h/mo | Sleeps after 15 min idle (~50 s cold start). Keep warm with UptimeRobot free 5-min pings; $7/mo Starter removes it at launch. Koyeb is the fallback. |
| Files/media | **Cloudflare R2** | 10 GB, **zero egress** | S3-compatible; presigned uploads. Best free home for the hero videos. |
| Email | **Resend** | 3,000/mo | Already in use; needs paizeiscy.com verified |
| Push | **Expo Push** + FCM | free | APNs needs the Apple account below |
| Maps | **react-native-maps** | free | Apple Maps on iOS (no key), Google Maps SDK on Android (free key) |
| Payments | **Stripe** | no monthly fee | Per-transaction only |
| Errors | **Sentry** | 5k events/mo | Replaces [errorReporting.ts](src/lib/errorReporting.ts) |
| Builds | **EAS Build** | limited free builds/mo | Local builds as fallback |

**Not free, and unavoidable:** Apple Developer Program **$99/year**, Google Play **$25 one-time**. Everything else on this list stays at $0 through launch.

---

## MongoDB data model

Mostly a 1:1 mirror of the Postgres tables — deliberately conservative, so the migration is verifiable — with three considered denormalizations.

| Collection | Shape | Key indexes |
|---|---|---|
| `users` | account + profile merged (`email`, `passwordHash`, `fullName`, `avatarUrl`, `phone`, `location`, `roles[]`, `googleId`, `appleId`) | `email` unique |
| `venues` | **`pitches[]` embedded** (bounded ~10, always co-fetched), `location` as GeoJSON Point, `openingHours`, `depositRate` | `2dsphere` on `location`, `city` |
| `bookings` | `startsAt`/`endsAt` as **UTC Date**, `venueId` + `pitchId` + name snapshots, `status`, `holdExpiresAt` | `{pitchId, startsAt}` unique · `{pitchId, startsAt, endsAt}` · TTL on `holdExpiresAt` |
| `pitchBlocks` | maintenance windows, own collection (fixes defect #4) | `{pitchId, startsAt}` |
| `teams` | **`roster[]` embedded** (bounded, `userId` + `position` + `isCaptain`) | `captainId`, `roster.userId` |
| `venueManagers` | userId ↔ venueId | `{userId, venueId}` unique |
| `invitations` | token, type, expiry | `token` unique, TTL on `expiresAt` |
| `playerStats`, `matchStats`, `playerListings` | mirror | `userId` |
| `tournaments`, `tournamentTeams`, `tournamentMatches` | mirror (migrated, not in V1 app) | |
| `devices` | Expo push tokens per user | `userId` |
| `rateLimits` | server-side counters | TTL |

Three details that matter:

- **Times are UTC `Date`, not `date` + `"HH:MM"` strings.** Cyprus is Europe/Nicosia with DST; slot rendering converts to venue-local time with `date-fns-tz`. The current string model silently breaks twice a year.
- **A pending booking holds its slot for 15 minutes** (`holdExpiresAt`, TTL index). Unpaid holds release themselves instead of blocking the pitch forever.
- **CRM collections** (`clients`, `deals`, `invoices`) migrate for web parity only — [CRM.tsx](src/pages/CRM.tsx) is a Lovable template leftover reachable at `/crm` and referenced nowhere in the nav. It is absent from the app and is a good candidate for deletion once you confirm no real data sits in it.

---

## API — route map

Base: `/api/v1`. Every route is `public`, `auth`, `venueManager`, or `admin`; the tag *is* the middleware.

**Auth** — `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/google` · `POST /auth/apple` · `POST /auth/password/forgot` · `POST /auth/password/reset` *(all public)*

**Me** *(auth)* — `GET|PATCH /me` · `POST /me/avatar` · `GET /me/bookings` · `GET /me/stats` · `POST /me/devices` · **`DELETE /me`** *(account deletion — App Store 5.1.1(v) requires it in-app)*

**Venues** *(public)* — `GET /venues` (`?city=&sport=&pitchType=&q=&near=lat,lng&radius=`) · `GET /venues/cities` · `GET /venues/:id` · `GET /venues/:id/pitches`

**Availability** *(public)* — `GET /venues/:id/availability?date=&pitchType=&duration=` → real slots: opening hours − confirmed/held bookings − maintenance blocks − past times. This endpoint replaces [Booking.tsx:148-175](src/pages/Booking.tsx#L148-L175) outright.

**Bookings** *(auth)* — `POST /bookings` (transaction: re-check conflict → insert → 15-min hold) · `GET /bookings/:id` · `POST /bookings/:id/checkout` (Stripe session, server-computed amount) · `POST /bookings/:id/cancel`

**Teams** *(auth)* — `GET|POST /teams` · `GET|PATCH|DELETE /teams/:id` · `GET|POST /teams/:id/roster` · `DELETE /teams/:id/roster/:userId` · `POST /teams/:id/invitations`

**Invitations** — `GET /invitations/:token` *(public)* · `POST /invitations/:token/accept` *(auth)*

**Webhooks** *(public, signature-verified)* — `POST /webhooks/stripe` — a direct port of [stripe-webhook/index.ts](supabase/functions/stripe-webhook/index.ts), plus releasing the hold on failure.

**Venue manager** *(venueManager)* — `GET /venue-admin/venues` · `GET /venue-admin/bookings` · `PATCH /venue-admin/bookings/:id` · `GET|POST|DELETE /venue-admin/blocks` · `GET /venue-admin/analytics`

**Admin** *(admin)* — `GET|POST|PATCH|DELETE /admin/venues` · `POST /admin/venues/:id/geocode` · `GET|POST|DELETE /admin/venue-managers` · `GET /admin/users` · `GET /admin/stats`

**Reserved for the monthly rollouts** — `/tournaments/*` · `/stats/*` · `/rewards/*` · `/listings/*` (built on the web today, hidden in the navbar).

### Server layout

```
apps/api/src/
├─ app.ts                 helmet · cors · rate limit · routes · error handler
├─ config/env.ts          Zod-validated environment (fails fast on boot)
├─ db/mongo.ts
├─ models/                one Mongoose schema per collection
├─ middleware/            authenticate · authorize · validate(zod) · rateLimit · errors
├─ modules/<domain>/      routes.ts · controller.ts · service.ts · policies.ts
│    auth · venues · availability · bookings · teams · invitations · payments · venueAdmin · admin
└─ routes.ts              mounts /api/v1/*
```

### Replacing 160 RLS policies — the critical piece

Every policy in [supabase/migrations/](supabase/migrations/) becomes a named predicate in the owning module's `policies.ts` (`canViewBooking`, `canManageVenue`, `isTeamCaptain`, `isRosterMember`, …). Two rules keep this honest:

- **Controllers never query Mongo directly.** They call a service, and every service method takes the actor as its first argument. No actor, no data.
- **`docs/authorization.md` is a table**: table → old policy → new predicate → the test that proves it. Built by walking the migrations once, at the start of Phase 2, not reconstructed from memory later.

The existing [rls-selftest](supabase/functions/rls-selftest/index.ts) edge function is the model for the acceptance suite: a signed-in non-owner must get 403/404 on every owned resource.

---

## Mobile app (Expo)

```
apps/mobile/
├─ app/
│  ├─ (auth)/          sign-in · sign-up · forgot-password
│  ├─ (tabs)/          index (home) · venues · teams · profile
│  ├─ venue/[id].tsx
│  ├─ booking/[venueId].tsx   pitch type → pitch → date/time → team → deposit
│  └─ booking/success.tsx
└─ src/
   ├─ auth/            expo-secure-store token store + refresh interceptor
   ├─ components/      RN equivalents of the shadcn primitives actually used
   ├─ theme/           tokens ported from tailwind.config.ts
   └─ i18n/            EN/EL lifted from useLanguage.tsx
```

- **Look and feel carry over, markup does not.** The black / neon-green / pixel-mono identity ports through `theme/`; `expo-video` and `expo-image` replace the `<video>`/`<img>` hero elements in [Index.tsx](src/pages/Index.tsx).
- **Data via TanStack Query** (already a dependency on web) against `@paizeis/api-client` — replacing the `useState` + `useEffect` + direct-Supabase pattern in every current page.
- **Native where it counts:** `react-native-maps` for [VenuesMap.tsx](src/components/VenuesMap.tsx), `expo-location` for the near-me sort already in [Venues.tsx](src/pages/Venues.tsx), `expo-image-picker` for avatars, Expo Push for booking confirmations.
- **Payments open Stripe Checkout in an in-app browser.** Pitch hire is a real-world service, so Apple's IAP requirement does not apply (Guideline 3.1.3(e)) — external payment is permitted, and this keeps one payment path across web and app.
- **Media must be re-hosted before this phase.** The `.asset.json` files point at Lovable's `/__l5e/` CDN, which will not exist for a native binary. Download originals, upload to R2, generate a manifest to replace the asset JSONs.

---

## Web cutover

[App.tsx](src/App.tsx), [routeAccess.ts](src/routes/routeAccess.ts) and every page's markup stay as they are. What changes:

- [AuthContext.tsx](src/contexts/AuthContext.tsx) — Supabase session → JWT + refresh from the API
- [useAdminRole.tsx](src/hooks/useAdminRole.tsx) — two Supabase queries → `roles[]` on `GET /me`
- Each page's `supabase.from(...)` calls → `@paizeis/api-client` hooks
- [client.ts](src/integrations/supabase/client.ts) and [types.ts](src/integrations/supabase/types.ts) deleted last, when nothing imports them

---

## Migration (`tools/migrate`)

Read Supabase over a direct Postgres connection → transform → write to Atlas, in FK order: `users → venues(+pitches) → teams(+roster) → bookings → invitations → stats → tournaments`.

- **UUID → ObjectId** through a persisted `idMap` so reruns are idempotent.
- **Passwords survive.** Supabase stores bcrypt hashes in `auth.users.encrypted_password`, readable over the direct connection and verifiable by `bcryptjs`. Everyone keeps their password. If that column turns out to be inaccessible, the fallback is a forced reset email to all users — decide this in Phase 1, not on cutover day.
- **`booking_date` + `"HH:MM"` → UTC `startsAt`/`endsAt`**, interpreting the originals as Europe/Nicosia local time.
- **`status: "blocked"` bookings → `pitchBlocks`**, dropping the `team_id = pitch_id` hack.
- **Parity script**: per-collection counts vs source, plus spot-checks on a known booking, team and venue. Run against a scratch Atlas database first; the production run is a repeat, not a first attempt.

---

## Store submission requirements

Non-negotiable, and cheaper to build in than to retrofit:

- **Sign in with Apple** — mandatory because Google sign-in is offered (Guideline 4.8)
- **In-app account deletion** — `DELETE /me` wired to a Profile screen action (5.1.1(v))
- **Privacy policy URL** + App Privacy labels (location, email, name, photos)
- **Permission strings** — `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`, push
- Screenshots for required device sizes, age rating, Play Data Safety form
- Google Play requires a **closed test with 12 testers for 14 days** before production for new personal developer accounts — start that clock at the beginning of Phase 6, not the end

---

## Phases

Estimates from **Day 0 = 25 August 2026**, assuming steady solo work.

| Phase | Days | Target | Output |
|---|---|---|---|
| 0 · Foundations | 1–3 | ~28 Aug | Monorepo, Atlas M0, R2 bucket, `packages/shared` with the existing Zod schemas, CI |
| 1 · Data + migration | 4–8 | ~2 Sep | Mongoose models, indexes, migration script green against scratch DB |
| 2 · Auth + authorization | 9–14 | ~8 Sep | JWT/refresh, Google + Apple, `docs/authorization.md`, policy suite passing |
| 3 · Domain API | 15–24 | ~18 Sep | Venues, **real availability**, transactional bookings, teams, Stripe, invitations |
| 4 · Web cutover | 25–31 | ~25 Sep | Site running entirely on the new API; Supabase read-only |
| 5 · Mobile V1 | 32–52 | ~16 Oct | Expo app: auth, home, venues+map, booking, teams, profile; TestFlight + internal track |
| 6 · Store submission | 53–60 | ~24 Oct | Compliance items, assets, Play closed test started, App Store review |

Phase 3 is the one that slips — it holds the availability engine and the payment path, the two pieces with no existing correct implementation to copy.

---

## Verification

**API** — Vitest + Supertest against `mongodb-memory-server`.
- *The test that defines success:* 20 concurrent `POST /bookings` for the same pitch/slot → exactly 1 succeeds, 19 get 409. Without this, the port has not fixed the thing it exists to fix.
- Availability correctness: a booked slot disappears; a maintenance block disappears; an expired hold reappears; slots are right on a DST boundary.
- Authorization: for each owned resource, a signed-in non-owner gets 403/404. One case per row of `docs/authorization.md`.
- Stripe webhook replay with a real signed test payload.

**Migration** — parity script (counts + spot-checks), then log in to the migrated web app as a real pre-migration user with their original password.

**Web** — `npm run dev` in `apps/web` against a local API; walk sign-in → venues → book → pay (Stripe test card `4242…`) → confirmation, and confirm the booking flips to `confirmed` via webhook.

**Mobile** — Expo dev client on a physical iPhone and Android device: same walk-through, plus location permission, offline behaviour, and a push notification on booking confirmation. Then an EAS preview build, then TestFlight internal.

**Ship gate** — the same booking made on the phone appears on the website, and vice versa, from one Atlas cluster.

---

## Open items, non-blocking

- **`/crm`** — migrated for parity; confirm whether it holds real data or gets deleted.
- **Render cold starts** — acceptable through beta; budget $7/mo before the app is public.
- **Venue coordinates** — [geocode-venues](supabase/functions/geocode-venues/index.ts) becomes `POST /admin/venues/:id/geocode`; run once over the 25 venues and store the results, so no map API is on the hot path.
