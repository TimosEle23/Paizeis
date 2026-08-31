/**
 * Supabase → MongoDB migration.
 *
 *   npm run migrate --workspace @paizeis/migrate
 *
 * Idempotent: every document is upserted under an id derived from its source
 * UUID and persisted in .idmap.json, so a rerun updates rather than duplicates.
 * That matters because this runs at least twice — a rehearsal against a scratch
 * database, then the real cutover.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { resolve } from "node:path";
import {
  UserModel, VenueModel, BookingModel, PitchBlockModel, TeamModel, VenueManagerModel,
  PlayerStatsModel, MatchStatsModel, PlayerListingModel,
  TournamentModel, TournamentTeamModel, TournamentMatchModel,
} from "@paizeis/api/models";
import { DEFAULT_DEPOSIT_RATE, DEFAULT_OPENING_HOURS } from "@paizeis/shared";
import { IdMap } from "./idmap.js";
import { loadExport } from "./loadExport.js";
import {
  mapBookingStatus, normalisePitchType, objectIdOrNull, optionalDate, toGeoPoint, toUtc,
  type Row,
} from "./transform.js";

const EXPORT_PATH = resolve(process.env.EXPORT_PATH ?? "data/export.json");
const IDMAP_PATH = resolve(".idmap.json");

const now = new Date();
const warnings: string[] = [];
const counts: Record<string, number> = {};

function warn(message: string): void {
  warnings.push(message);
}

/** Upserts by _id so reruns update in place. */
async function upsert(model: any, docs: Array<Record<string, unknown>>, label: string): Promise<void> {
  if (docs.length === 0) {
    counts[label] = 0;
    return;
  }
  await model.bulkWrite(
    docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
    { ordered: false },
  );
  counts[label] = docs.length;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required (see tools/migrate/.env.example)");

  const data = loadExport(EXPORT_PATH);
  const map = new IdMap(IDMAP_PATH);

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? "paizeis" });
  console.log(`source  ${EXPORT_PATH}`);
  console.log(`target  ${mongoose.connection.name} on ${mongoose.connection.host}\n`);

  const rows = (table: string): Row[] => (Array.isArray(data[table]) ? (data[table] as Row[]) : []);

  // ── users ────────────────────────────────────────────────────────────────
  // auth.users and profiles are merged; there was never a profile without an
  // account. Roles come from user_roles; venue-manager scope does not live here.
  const profilesById = new Map(rows("profiles").map((p) => [p.id, p]));
  const adminIds = new Set(rows("user_roles").filter((r) => r.role === "admin").map((r) => r.user_id));

  const users = rows("users").map((u) => {
    const profile = profilesById.get(u.id) ?? {};
    const meta = u.raw_user_meta_data ?? {};
    const hash = typeof u.encrypted_password === "string" && u.encrypted_password.length > 0
      ? u.encrypted_password
      : null;

    if (!profile.id) warn(`user ${u.email} has no profile row; name taken from auth metadata`);

    return {
      _id: map.objectIdFor("users", u.id),
      email: String(u.email ?? "").toLowerCase(),
      passwordHash: hash,
      fullName: profile.full_name || meta.full_name || meta.name || String(u.email ?? "").split("@")[0],
      avatarUrl: profile.avatar_url ?? null,
      phone: profile.phone ?? null,
      location: profile.location ?? null,
      roles: adminIds.has(u.id) ? ["user", "admin"] : ["user"],
      // Provider subject ids are not in the export. They are linked on the
      // user's first sign-in with that provider, matched on verified email.
      googleId: null,
      appleId: null,
      emailVerifiedAt: optionalDate(u.email_confirmed_at),
      lastSignInAt: optionalDate(u.last_sign_in_at),
      createdAt: optionalDate(u.created_at) ?? now,
      updatedAt: optionalDate(u.updated_at) ?? now,
    };
  });
  await upsert(UserModel, users, "users");

  // ── venues (+ embedded pitches) ───────────────────────────────────────────
  const pitchesByVenue = new Map<string, Row[]>();
  for (const pitch of rows("pitches")) {
    const list = pitchesByVenue.get(pitch.venue_id) ?? [];
    list.push(pitch);
    pitchesByVenue.set(pitch.venue_id, list);
  }

  const venues = rows("venues").map((v) => {
    const geo = toGeoPoint(v.latitude, v.longitude);
    if (!geo) warn(`venue "${v.name}" has no coordinates and will not appear in near-me results`);

    return {
      _id: map.objectIdFor("venues", v.id),
      name: v.name,
      city: v.city,
      location: v.location,
      ...(geo ? { geo } : {}),
      phone: v.phone ?? null,
      website: v.website ?? null,
      imageUrl: v.image_url ?? null,
      futsalImageUrl: v.futsal_image_url ?? null,
      paddleImageUrl: v.paddle_image_url ?? null,
      googleRating: v.google_rating ?? null,
      googleReviewsCount: v.google_reviews_count ?? null,
      bookingMethod: v.booking_method ?? null,
      openingHours: { ...DEFAULT_OPENING_HOURS },
      depositRate: DEFAULT_DEPOSIT_RATE,
      pitches: (pitchesByVenue.get(v.id) ?? []).map((p) => ({
        _id: map.objectIdFor("pitches", p.id),
        name: p.name,
        pitchType: normalisePitchType(p.pitch_type),
        pricePerHour: Number(p.price_per_hour ?? 0),
        features: Array.isArray(p.features) ? p.features : [],
        isAvailable: p.is_available !== false,
        createdAt: optionalDate(p.created_at) ?? now,
        updatedAt: now,
      })),
      createdAt: optionalDate(v.created_at) ?? now,
      updatedAt: now,
    };
  });
  await upsert(VenueModel, venues, "venues");
  counts.pitches = venues.reduce((total, v) => total + v.pitches.length, 0);

  // Index pitches so bookings can resolve their venue and snapshot names.
  const pitchIndex = new Map<string, { venue: (typeof venues)[number]; pitch: any }>();
  for (const venue of venues) {
    for (const pitch of venue.pitches) pitchIndex.set(pitch._id.toHexString(), { venue, pitch });
  }

  // ── venue managers ────────────────────────────────────────────────────────
  const venueManagers = rows("venue_managers").flatMap((vm) => {
    const userId = objectIdOrNull(map, "users", vm.user_id);
    const venueId = objectIdOrNull(map, "venues", vm.venue_id);
    if (!userId || !venueId) {
      warn(`venue_manager ${vm.id} references a missing user or venue; skipped`);
      return [];
    }
    return [{
      _id: map.objectIdFor("venue_managers", vm.id),
      userId, venueId, createdBy: null,
      createdAt: optionalDate(vm.created_at) ?? now,
      updatedAt: now,
    }];
  });
  await upsert(VenueManagerModel, venueManagers, "venueManagers");

  // ── teams (roster = team_roster ∪ team_members) ───────────────────────────
  // Supabase kept two overlapping tables. team_roster is authoritative on
  // membership and captaincy; team_members contributes pending and declined
  // invitations that the roster table never recorded.
  const rosterByTeam = new Map<string, Map<string, Row>>();
  const addRosterEntry = (teamUuid: string, userUuid: string, entry: Row, wins: boolean) => {
    const team = rosterByTeam.get(teamUuid) ?? new Map<string, Row>();
    if (wins || !team.has(userUuid)) team.set(userUuid, entry);
    rosterByTeam.set(teamUuid, team);
  };

  for (const m of rows("team_members")) {
    addRosterEntry(m.team_id, m.user_id, { ...m, status: m.status ?? "accepted" }, false);
  }
  for (const r of rows("team_roster")) {
    addRosterEntry(r.team_id, r.user_id, { ...r, status: "accepted" }, true);
  }

  const teams = rows("teams").flatMap((t) => {
    const captainId = objectIdOrNull(map, "users", t.captain_id);
    if (!captainId) {
      warn(`team "${t.name}" has no resolvable captain; skipped`);
      return [];
    }
    const entries = [...(rosterByTeam.get(t.id) ?? new Map()).values()].flatMap((entry) => {
      const userId = objectIdOrNull(map, "users", entry.user_id);
      if (!userId) return [];
      return [{
        userId,
        position: entry.position ?? null,
        isCaptain: entry.is_captain === true || entry.user_id === t.captain_id,
        status: entry.status ?? "accepted",
        joinedAt: optionalDate(entry.created_at) ?? now,
      }];
    });

    return [{
      _id: map.objectIdFor("teams", t.id),
      name: t.name,
      captainId,
      roster: entries,
      createdAt: optionalDate(t.created_at) ?? now,
      updatedAt: now,
    }];
  });
  await upsert(TeamModel, teams, "teams");
  counts.rosterEntries = teams.reduce((total, t) => total + t.roster.length, 0);

  // ── bookings and maintenance blocks ───────────────────────────────────────
  const bookings: Row[] = [];
  const blocks: Row[] = [];

  for (const b of rows("bookings")) {
    const pitchId = objectIdOrNull(map, "pitches", b.pitch_id);
    const entry = pitchId ? pitchIndex.get(pitchId.toHexString()) : undefined;
    if (!pitchId || !entry) {
      warn(`booking ${b.id} references a missing pitch; skipped`);
      continue;
    }

    const startsAt = toUtc(b.booking_date, b.start_time);
    let endsAt = toUtc(b.booking_date, b.end_time);
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000); // crosses midnight

    const userId = objectIdOrNull(map, "users", b.user_id);

    // Maintenance windows were stored as bookings with status "blocked" and
    // team_id set to the pitch id. They become first-class blocks.
    if (b.status === "blocked") {
      blocks.push({
        _id: map.objectIdFor("bookings", b.id),
        venueId: entry.venue._id, pitchId, startsAt, endsAt,
        reason: "Migrated maintenance block",
        createdBy: userId ?? entry.venue._id,
        createdAt: optionalDate(b.created_at) ?? now,
        updatedAt: now,
      });
      continue;
    }

    const teamId = objectIdOrNull(map, "teams", b.team_id);
    if (!userId || !teamId) {
      warn(`booking ${b.id} references a missing user or team; skipped`);
      continue;
    }

    const durationHours = (endsAt.getTime() - startsAt.getTime()) / 3600_000;
    const { status, holdExpiresAt } = mapBookingStatus(b.status, startsAt, now);

    bookings.push({
      _id: map.objectIdFor("bookings", b.id),
      venueId: entry.venue._id, pitchId, teamId, userId,
      venueName: entry.venue.name,
      pitchName: entry.pitch.name,
      pitchType: entry.pitch.pitchType,
      startsAt, endsAt, durationHours,
      totalAmount: Number(b.total_amount ?? 0),
      depositAmount: Number(b.deposit_amount ?? 0),
      status, holdExpiresAt,
      players: [],
      createdAt: optionalDate(b.created_at) ?? now,
      updatedAt: now,
    });
  }
  await upsert(BookingModel, bookings, "bookings");
  await upsert(PitchBlockModel, blocks, "pitchBlocks");

  // ── stats and listings ────────────────────────────────────────────────────
  await upsert(PlayerStatsModel, rows("player_stats").flatMap((s) => {
    const userId = objectIdOrNull(map, "users", s.user_id);
    if (!userId) return [];
    return [{
      _id: map.objectIdFor("player_stats", s.id), userId,
      goals: s.goals ?? 0, assists: s.assists ?? 0, wins: s.wins ?? 0, losses: s.losses ?? 0,
      cleanSheets: s.clean_sheets ?? 0, totalMatches: s.total_matches ?? 0,
      createdAt: optionalDate(s.created_at) ?? now, updatedAt: now,
    }];
  }), "playerStats");

  await upsert(MatchStatsModel, rows("match_stats").flatMap((s) => {
    const userId = objectIdOrNull(map, "users", s.user_id);
    const bookingId = objectIdOrNull(map, "bookings", s.booking_id);
    const teamId = objectIdOrNull(map, "teams", s.team_id);
    if (!userId || !bookingId || !teamId) {
      warn(`match_stats ${s.id} references a missing user, booking or team; skipped`);
      return [];
    }
    return [{
      _id: map.objectIdFor("match_stats", s.id), userId, bookingId, teamId,
      matchDate: new Date(s.match_date),
      goals: s.goals ?? 0, assists: s.assists ?? 0, cleanSheet: s.clean_sheet === true,
      createdAt: optionalDate(s.created_at) ?? now, updatedAt: now,
    }];
  }), "matchStats");

  await upsert(PlayerListingModel, rows("player_listings").flatMap((l) => {
    const userId = objectIdOrNull(map, "users", l.user_id);
    if (!userId) return [];
    return [{
      _id: map.objectIdFor("player_listings", l.id), userId,
      listingType: l.listing_type, position: l.position ?? null, city: l.city ?? null,
      availableDays: Array.isArray(l.available_days) ? l.available_days : [],
      message: l.message ?? null, isActive: l.is_active !== false,
      createdAt: optionalDate(l.created_at) ?? now, updatedAt: now,
    }];
  }), "playerListings");

  // ── tournaments ───────────────────────────────────────────────────────────
  await upsert(TournamentModel, rows("tournaments").map((t) => ({
    _id: map.objectIdFor("tournaments", t.id),
    name: t.name,
    venueId: objectIdOrNull(map, "venues", t.venue_id),
    startDate: new Date(t.start_date),
    endDate: optionalDate(t.end_date),
    maxTeams: t.max_teams ?? null, prize: t.prize ?? null, status: t.status ?? "upcoming",
    createdAt: optionalDate(t.created_at) ?? now, updatedAt: now,
  })), "tournaments");

  await upsert(TournamentTeamModel, rows("tournament_teams").flatMap((tt) => {
    const tournamentId = objectIdOrNull(map, "tournaments", tt.tournament_id);
    const teamId = objectIdOrNull(map, "teams", tt.team_id);
    if (!tournamentId || !teamId) return [];
    return [{
      _id: map.objectIdFor("tournament_teams", tt.id), tournamentId, teamId,
      points: tt.points ?? 0, wins: tt.wins ?? 0, losses: tt.losses ?? 0,
      goalsFor: tt.goals_for ?? 0, goalsAgainst: tt.goals_against ?? 0,
      createdAt: optionalDate(tt.created_at) ?? now, updatedAt: now,
    }];
  }), "tournamentTeams");

  await upsert(TournamentMatchModel, rows("tournament_matches").flatMap((m) => {
    const tournamentId = objectIdOrNull(map, "tournaments", m.tournament_id);
    const team1Id = objectIdOrNull(map, "teams", m.team1_id);
    const team2Id = objectIdOrNull(map, "teams", m.team2_id);
    if (!tournamentId || !team1Id || !team2Id) return [];
    return [{
      _id: map.objectIdFor("tournament_matches", m.id), tournamentId, team1Id, team2Id,
      round: m.round, team1Score: m.team1_score ?? null, team2Score: m.team2_score ?? null,
      matchDate: optionalDate(m.match_date), status: m.status ?? "scheduled",
      createdAt: optionalDate(m.created_at) ?? now, updatedAt: now,
    }];
  }), "tournamentMatches");

  map.save();

  // Indexes last: building them after the writes is faster, and it is the point
  // at which a data problem the schema forbids would surface loudly.
  console.log("building indexes…");
  for (const model of [
    UserModel, VenueModel, BookingModel, PitchBlockModel, TeamModel, VenueManagerModel,
    PlayerStatsModel, MatchStatsModel, PlayerListingModel,
    TournamentModel, TournamentTeamModel, TournamentMatchModel,
  ]) {
    await model.syncIndexes();
  }

  console.log("\nmigrated");
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(20)} ${String(count).padStart(4)}`);
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 20)) console.log(`  • ${w}`);
    if (warnings.length > 20) console.log(`  … and ${warnings.length - 20} more`);
  }

  console.log(`\nid map: ${map.size} entries → ${IDMAP_PATH}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
