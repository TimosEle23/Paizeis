import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { addDays, startOfDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { format, toZonedTime } from "date-fns-tz";
import { VENUE_TIMEZONE } from "@paizeis/shared";
import { createApp } from "../src/app.js";
import { BookingModel, PitchBlockModel, TeamModel, UserModel, VenueModel } from "../src/models/index.js";
import { clearDb, startTestDb, stopTestDb } from "./helpers.js";

const app = createApp();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

/** Tomorrow in Cyprus, so slots are always in the future regardless of run time. */
function tomorrow(): string {
  const local = toZonedTime(addDays(new Date(), 1), VENUE_TIMEZONE);
  return format(startOfDay(local), "yyyy-MM-dd", { timeZone: VENUE_TIMEZONE });
}

async function seed() {
  const venue = await VenueModel.create({
    name: "Wembley Futsal Fields",
    city: "Nicosia",
    location: "Lakatamia",
    geo: { type: "Point", coordinates: [33.3273, 35.1056] },
    openingHours: { open: "09:00", close: "21:00" },
    depositRate: 0.2,
    pitches: [
      { name: "Pitch 1", pitchType: "5v5", pricePerHour: 45, isAvailable: true },
      { name: "Pitch 2", pitchType: "5v5", pricePerHour: 50, isAvailable: true },
    ],
  });

  const register = async (email: string) => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password: "Kalimera123", fullName: email.split("@")[0] });
    return res.body as { accessToken: string; user: { id: string } };
  };

  const owner = await register("captain@paizeiscy.com");
  const team = await TeamModel.create({
    name: "Warriors FC",
    captainId: owner.user.id,
    roster: [{ userId: owner.user.id, isCaptain: true, status: "accepted" }],
  });

  return { venue, owner, team, pitchId: String(venue.pitches[0]!._id) };
}

describe("availability", () => {
  it("generates slots from the venue's own opening hours", async () => {
    const { venue } = await seed();
    const res = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1 });

    expect(res.status).toBe(200);
    const slots = res.body.pitches[0].slots;
    // 09:00 to 21:00, 1-hour slots on a 30-minute grid → 23 start times.
    expect(slots).toHaveLength(23);
    expect(slots.every((s: { available: boolean }) => s.available)).toBe(true);
  });

  it("prices a slot from the pitch's hourly rate and the requested duration", async () => {
    const { venue } = await seed();
    const res = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1.5 });

    expect(res.body.pitches[0].slots[0].pricePerSlot).toBe(67.5); // 45 × 1.5
  });

  it("removes a slot that is already booked", async () => {
    const { venue, owner, team, pitchId } = await seed();
    const startsAt = fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString();

    await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ pitchId, teamId: team.id, startsAt, duration: 1 })
      .expect(201);

    const res = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1 });

    const slot = res.body.pitches[0].slots.find((s: { startsAt: string }) => s.startsAt === startsAt);
    expect(slot.available).toBe(false);
    expect(slot.reason).toBe("booked");

    // The other pitch at the same time is untouched.
    const otherPitch = res.body.pitches[1].slots.find((s: { startsAt: string }) => s.startsAt === startsAt);
    expect(otherPitch.available).toBe(true);
  });

  it("allows a back-to-back booking immediately after another", async () => {
    const { venue, owner, team, pitchId } = await seed();
    const eighteen = fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString();
    const nineteen = fromZonedTime(`${tomorrow()}T19:00:00`, VENUE_TIMEZONE).toISOString();

    await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ pitchId, teamId: team.id, startsAt: eighteen, duration: 1 })
      .expect(201);

    // 18:00–19:00 must not block 19:00–20:00. Closed intervals would lose the
    // venue a slot between every pair of matches.
    const res = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1 });

    const slot = res.body.pitches[0].slots.find((s: { startsAt: string }) => s.startsAt === nineteen);
    expect(slot.available).toBe(true);
  });

  it("removes a slot closed for maintenance", async () => {
    const { venue, owner, pitchId } = await seed();
    const startsAt = fromZonedTime(`${tomorrow()}T14:00:00`, VENUE_TIMEZONE);

    await PitchBlockModel.create({
      venueId: venue._id,
      pitchId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600_000),
      reason: "Resurfacing",
      createdBy: owner.user.id,
    });

    const res = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1 });

    const slot = res.body.pitches[0].slots.find(
      (s: { startsAt: string }) => s.startsAt === startsAt.toISOString(),
    );
    expect(slot.available).toBe(false);
    expect(slot.reason).toBe("blocked");
  });
});

describe("creating a booking", () => {
  it("computes price and deposit server-side", async () => {
    const { owner, team, pitchId } = await seed();
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pitchId,
        teamId: team.id,
        startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
        duration: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(90);   // 45 × 2
    expect(res.body.depositAmount).toBe(18); // 20% of 90
    expect(res.body.status).toBe("held");
    expect(res.body.holdExpiresAt).toBeTruthy();
  });

  it("ignores any amount the client tries to send", async () => {
    const { owner, team, pitchId } = await seed();
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pitchId,
        teamId: team.id,
        startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
        duration: 1,
        totalAmount: 0.01,
        depositAmount: 0.01,
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(45);
    expect(res.body.depositAmount).toBe(9);
  });

  it("refuses a booking in the past", async () => {
    const { owner, team, pitchId } = await seed();
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pitchId,
        teamId: team.id,
        startsAt: new Date(Date.now() - 3600_000).toISOString(),
        duration: 1,
      });

    expect(res.status).toBe(400);
  });

  it("refuses to book on behalf of a team you are not on", async () => {
    const { team, pitchId } = await seed();
    const stranger = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "stranger@paizeiscy.com", password: "Kalimera123", fullName: "Stranger" });

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${stranger.body.accessToken}`)
      .send({
        pitchId,
        teamId: team.id,
        startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
        duration: 1,
      });

    expect(res.status).toBe(403);
  });

  it("requires authentication", async () => {
    const { team, pitchId } = await seed();
    const res = await request(app).post("/api/v1/bookings").send({
      pitchId,
      teamId: team.id,
      startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
      duration: 1,
    });

    expect(res.status).toBe(401);
  });
});

describe("double-booking", () => {
  /**
   * The test this rebuild exists for.
   *
   * The web app generated slots from a hardcoded list and never consulted the
   * bookings table, so two people could take the same pitch at the same time
   * and both be charged. Twenty simultaneous attempts must produce exactly one
   * booking.
   */
  it("lets exactly one of twenty concurrent requests win the same slot", async () => {
    const { team, pitchId } = await seed();
    const startsAt = fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString();

    const captain = await UserModel.findOne({ email: "captain@paizeiscy.com" });
    const tokens = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({ email: `rusher${i}@paizeiscy.com`, password: "Kalimera123", fullName: `Rusher ${i}` });
        // Everyone is on the same team, so team membership is not what decides this.
        await TeamModel.updateOne(
          { _id: team._id },
          { $push: { roster: { userId: res.body.user.id, status: "accepted" } } },
        );
        return res.body.accessToken as string;
      }),
    );
    expect(captain).toBeTruthy();

    const results = await Promise.all(
      tokens.map((token) =>
        request(app)
          .post("/api/v1/bookings")
          .set("Authorization", `Bearer ${token}`)
          .send({ pitchId, teamId: team.id, startsAt, duration: 1 }),
      ),
    );

    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);

    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    expect(rejected[0]!.body.error.code).toBe("SLOT_TAKEN");

    // And the database agrees.
    expect(await BookingModel.countDocuments({ pitchId, status: { $in: ["held", "confirmed"] } })).toBe(1);
  });

  it("rejects an overlapping booking that starts at a different time", async () => {
    const { owner, team, pitchId } = await seed();

    await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pitchId, teamId: team.id,
        startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
        duration: 1,
      })
      .expect(201);

    // 17:30–19:00 overlaps 18:00–19:00 but has a different start, so the unique
    // index cannot catch it — only the range query inside the transaction can.
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pitchId, teamId: team.id,
        startsAt: fromZonedTime(`${tomorrow()}T17:30:00`, VENUE_TIMEZONE).toISOString(),
        duration: 1.5,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLOT_TAKEN");
  });

  it("frees the slot again once a booking is cancelled", async () => {
    const { owner, team, pitchId } = await seed();
    const startsAt = fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString();

    const first = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ pitchId, teamId: team.id, startsAt, duration: 1 })
      .expect(201);

    await request(app)
      .post(`/api/v1/bookings/${first.body.id}/cancel`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ reason: "Rained off" })
      .expect(200);

    // A cancelled booking must not hold its slot forever — this is why the
    // unique index is partial rather than absolute.
    const second = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ pitchId, teamId: team.id, startsAt, duration: 1 });

    expect(second.status).toBe(201);
  });
});

describe("booking visibility", () => {
  it("hides a booking from an unrelated user as a 404", async () => {
    const { owner, team, pitchId } = await seed();
    const booking = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pitchId, teamId: team.id,
        startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
        duration: 1,
      });

    const stranger = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "nosy@paizeiscy.com", password: "Kalimera123", fullName: "Nosy" });

    const res = await request(app)
      .get(`/api/v1/bookings/${booking.body.id}`)
      .set("Authorization", `Bearer ${stranger.body.accessToken}`);

    // 404, not 403 — a 403 would confirm the booking exists.
    expect(res.status).toBe(404);
  });

  it("shows a booking to the person who made it", async () => {
    const { owner, team, pitchId } = await seed();
    const booking = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pitchId, teamId: team.id,
        startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
        duration: 1,
      });

    const res = await request(app)
      .get(`/api/v1/bookings/${booking.body.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.teamName).toBe("Warriors FC");
  });
});

describe("hidden pitches", () => {
  /**
   * Padel is hidden across the product by flagging its pitches unavailable
   * rather than deleting them — 30 of the 52 venues are padel-only and carry
   * geocoded coordinates and photos worth keeping. These tests hold the line
   * that a hidden pitch is invisible everywhere a player looks.
   */
  it("drops a venue whose every pitch is hidden", async () => {
    await VenueModel.create({
      name: "Padel Syndicate",
      city: "Limassol",
      location: "April 1st street",
      geo: { type: "Point", coordinates: [33.02, 34.7] },
      pitches: [{ name: "Court 1", pitchType: "padel", pricePerHour: 30, isAvailable: false }],
    });

    const res = await request(app).get("/api/v1/venues");
    expect(res.body.some((v: { name: string }) => v.name === "Padel Syndicate")).toBe(false);
  });

  it("keeps a mixed venue but hides only its hidden pitch", async () => {
    await VenueModel.create({
      name: "City Fields",
      city: "Nicosia",
      location: "Strovolos",
      geo: { type: "Point", coordinates: [33.35, 35.15] },
      pitches: [
        { name: "9v9 Pitch", pitchType: "9v9", pricePerHour: 55, isAvailable: true },
        { name: "Padel Court", pitchType: "padel", pricePerHour: 30, isAvailable: false },
      ],
    });

    const list = await request(app).get("/api/v1/venues");
    const venue = list.body.find((v: { name: string }) => v.name === "City Fields");
    expect(venue.pitches).toHaveLength(1);
    expect(venue.pitches[0].pitchType).toBe("9v9");

    // The detail page must agree with the list.
    const detail = await request(app).get(`/api/v1/venues/${venue.id}`);
    expect(detail.body.pitches).toHaveLength(1);
  });

  it("offers no slots for a hidden pitch", async () => {
    const venue = await VenueModel.create({
      name: "Fair Game Sport Center",
      city: "Larnaca",
      location: "Dromolaxia",
      openingHours: { open: "09:00", close: "21:00" },
      pitches: [{ name: "Padel Court", pitchType: "padel", pricePerHour: 30, isAvailable: false }],
    });

    const res = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1 });

    expect(res.body.pitches).toHaveLength(0);
  });
});
