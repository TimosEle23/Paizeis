# Paizeis

**Book a five-a-side pitch in Cyprus, from your phone.**

52 venues, real-time availability, deposit payments, squad management and team
chat — served by one API to a React Native app and a React website.

<!-- Add screenshots here: apps/mobile screens make the strongest first impression.
     Suggested: home, venues list, booking grid, team chat. -->

---

## What this is

Paizeis started as a Lovable-generated website talking directly to Supabase from
the browser. This repository is its rebuild: a MongoDB backend that owns the
data, a REST API that owns the rules, and a native app built on top of both.

The interesting problems were not the CRUD.

### The booking engine had no engine

The original site generated its time slots from a hardcoded list:

```ts
const unavailableHours = [11, 13, 16, 20];  // every venue, every day
```

It never consulted the bookings table. Two people could take the same pitch at
the same time and both be charged.

Fixing it properly needs two mechanisms, because either alone is insufficient:

- **A partial unique index** on `(pitchId, startsAt)`, restricted to statuses
  that actually occupy the pitch. The storage layer rejects a duplicate no
  matter what the application does — and because it is *partial*, a cancelled
  booking does not hold its slot forever.
- **A range query inside a transaction.** Identical start times are the easy
  collision; a 17:30–19:00 booking conflicts with 18:00–19:00 while having a
  different start, and no unique index can see that.

The test that defines success fires twenty concurrent requests at one slot and
asserts that **exactly one** succeeds:

```text
✓ double-booking > lets exactly one of twenty concurrent requests win the same slot
```

### 160 row-level security policies had to become code

Supabase enforced access with Postgres RLS. MongoDB has no equivalent, so every
rule became an explicit server-side check. Auditing the migrations gave the real
number: 160 `CREATE POLICY` statements, but **107 distinct policies** after
drop-and-recreate iterations, of which 73 needed porting — the rest were
Supabase Storage (replaced by presigned URLs) and dead template tables.

Two conventions carry the weight:

- **Every service method takes the actor as its first argument.** No actor, no
  data. Controllers never query the database.
- **404 over 403** for anything the caller should not know exists. A 403 on
  "team 5's chat" confirms team 5 has one.

`docs/authorization.md` maps each policy to its predicate and its test.

### Times are instants, not strings

The old schema stored `booking_date` plus `"18:00"` — which cannot express an
interval and means different things either side of a DST changeover. Bookings
now store UTC `Date` ranges and render in `Europe/Nicosia`. A test asserts the
round trip lands on the same wall clock.

### Nobody had to reset their password

Supabase keeps bcrypt hashes in `auth.users.encrypted_password`. The migration
carries all 16 across byte-identically, and the API verifies them with the same
algorithm — so 21 existing accounts kept working through a complete backend
replacement.

### The client/server boundary is enforced, not documented

`tools/check/boundaries.mjs` fails the build if a database driver is imported
outside the server. It also tracks the migration burn-down: how many web files
still reach for Supabase.

---

## Architecture

```text
   React Native (Expo)          React (Vite)
            │                        │
            └────────┬───────────────┘
                     │  @paizeis/shared — Zod schemas + contract types
                     ▼
              ┌──────────────┐
              │  apps/api    │  Express · TypeScript
              │              │
              │  authenticate│  who is this?
              │  authorize   │  may they?
              │  validate    │  is the input sane?
              │  controller  │  ← never touches the database
              │  service     │  ← takes the actor as arg 1
              └──────┬───────┘
                     ▼
            MongoDB Atlas (replica set)
```

| Workspace | Lines | What it is |
| --- | ---: | --- |
| `apps/api` | 3,247 | Express + Mongoose. 37 endpoints, 11 collections. |
| `apps/mobile` | 3,134 | Expo + expo-router. iOS and Android. |
| `apps/web` | — | The original Vite site, mid-migration. |
| `packages/shared` | 565 | Zod schemas and DTOs, imported by all three. |
| `tools` | 996 | Migration, boundary guard, asset pipeline. |

**57 tests** across 6 suites, run against a real MongoDB replica set
(`mongodb-memory-server`) rather than mocks — because transactions do not exist
on a standalone, and a test that passes without them proves nothing.

---

## Stack

**Server** — Node 20, Express 5, TypeScript, Mongoose, MongoDB Atlas, JWT with
rotating refresh sessions, bcrypt, Stripe, Expo Push, Vitest + Supertest.

**Mobile** — Expo SDK 54, React Native, expo-router, TanStack Query,
react-native-maps, expo-secure-store, expo-notifications.

**Web** — Vite, React 18, TypeScript, Tailwind, shadcn/ui.

**Deliberately free tier**: MongoDB Atlas M0, Cloudflare R2, Resend, Expo Push,
Sentry. The only unavoidable costs are the Apple and Google developer accounts.

---

## Running it

```sh
npm install

cp apps/api/.env.example apps/api/.env
# Fill in MONGODB_URI, and generate two secrets:
#   openssl rand -base64 48

npm run dev:api      # http://localhost:4000/api/v1/health
npm run dev:web      # http://localhost:8080
npm run dev:mobile   # Expo — scan the QR with Expo Go
```

`MONGODB_URI=memory` starts a real MongoDB replica set in-process, so the stack
runs with no external setup. Replica set specifically: booking depends on a
transaction, and a standalone would hide that.

### Checks

```sh
npm run check              # typecheck · boundaries · tests
npm run check:boundaries   # database drivers stay server-side
```

---

## Layout

```text
apps/
  api/          the only thing that touches MongoDB
  mobile/       Expo app — iOS and Android
  web/          the original site, migrating
packages/
  shared/       one contract, three consumers
tools/
  check/        client/server boundary guard
  migrate/      Supabase → MongoDB, idempotent and verified
  assets/       pulls media out of the previous host
docs/
  architecture.md
  authorization.md     RLS policy → predicate → test
  plan.md              the six-phase build plan
supabase/       the outgoing backend, kept until cutover completes
```

---

## Status

| Phase | Status |
| --- | --- |
| 0 · Monorepo, shared contract, API skeleton | ✅ |
| 1 · Models + Supabase migration (verified, idempotent) | ✅ |
| 2 · Auth, sessions, authorization layer | ✅ |
| 3 · Venues, availability, bookings, payments, teams, chat | ✅ |
| 4 · Web cutover — 30 files still import Supabase | in progress |
| 5 · Expo app — running on device | ✅ |
| 6 · App Store + Play submission | not started |

Honest about what is not done: the API is not yet deployed, Stripe and Resend
keys are not configured, and the venue-manager and admin surfaces exist as
mounted-but-empty routers.

---

## Licence

MIT — see [LICENSE](LICENSE).
