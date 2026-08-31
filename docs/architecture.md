# Architecture

## The one rule

`mongoose` and `mongodb` are imported in `apps/api` and nowhere else. Clients
reach data only over HTTP. `npm run check:boundaries` fails the build if that
stops being true.

This is the whole point of the rebuild: the old app shipped database
credentials to the browser and relied on Postgres row-level security to make
that safe. MongoDB has no equivalent of RLS, so authorization moves into the
server — see `authorization.md`.

## Request path

```
mobile (Expo)  ─┐
                ├─→  @paizeis/shared (Zod + contract types)
web (Vite)     ─┘                │
                                 ▼
                    apps/api  ── express
                                 ├─ authenticate    who is this?
                                 ├─ authorize       may they?
                                 ├─ validate(zod)   is the input sane?
                                 ├─ controller      no database access here
                                 ├─ service         takes the actor as arg 1
                                 └─ mongoose        MongoDB Atlas
```

Controllers never query Mongo directly, and every service method takes the
acting user as its first argument. No actor, no data — that convention is what
replaces "the database checks it for us".

## Times

Bookings store `startsAt` / `endsAt` as UTC `Date`. Slot rendering converts to
`Europe/Nicosia`. The old schema kept a `date` column plus `"HH:MM"` strings,
which silently misbehaves on the two DST changeovers each year.

## Money

The deposit rate lives in `@paizeis/shared` (`DEFAULT_DEPOSIT_RATE`), overridable
per venue. Clients display it; only the server computes it. The old app stored
15% while displaying 20%, because the number existed in two places.

## Slot holds

A new booking is created `held` with `holdExpiresAt` 15 minutes out, and a TTL
index reaps it. Payment flips it to `confirmed` via the Stripe webhook. This
means an abandoned checkout releases the pitch on its own.
