import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { addDays } from "date-fns";
import { format, fromZonedTime, toZonedTime } from "date-fns-tz";
import { VENUE_TIMEZONE } from "@paizeis/shared";
import { createApp } from "../src/app.js";
import { VenueModel } from "../src/models/index.js";
import { clearDb, startTestDb, stopTestDb } from "./helpers.js";

/**
 * The journey a player actually takes in the app: sign up with no team at all,
 * create one from the booking screen, pick a slot, reserve it.
 *
 * Every earlier booking test seeded a team directly. This one starts from a
 * brand-new account, which is the state every real first booking is made from.
 */
const app = createApp();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

function tomorrow(): string {
  return format(toZonedTime(addDays(new Date(), 1), VENUE_TIMEZONE), "yyyy-MM-dd", { timeZone: VENUE_TIMEZONE });
}

async function seedVenue() {
  return VenueModel.create({
    name: "City Fields",
    city: "Nicosia",
    location: "Strovolos",
    geo: { type: "Point", coordinates: [33.35, 35.15] },
    openingHours: { open: "09:00", close: "21:00" },
    depositRate: 0.2,
    pitches: [{ name: "9v9 Pitch", pitchType: "9v9", pricePerHour: 55, isAvailable: true }],
  });
}

describe("first booking, from a brand-new account", () => {
  it("signs up, creates a team, and reserves a slot", async () => {
    const venue = await seedVenue();
    const pitchId = String(venue.pitches[0]!._id);

    const signUp = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "newplayer@paizeiscy.com", password: "Kalimera123", fullName: "New Player" })
      .expect(201);
    const token = signUp.body.accessToken as string;

    // A new account has no teams, which is exactly why the booking screen
    // offers to create one inline.
    const noTeams = await request(app).get("/api/v1/teams").set("Authorization", `Bearer ${token}`);
    expect(noTeams.body).toEqual([]);

    const team = await request(app)
      .post("/api/v1/teams")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Warriors FC" })
      .expect(201);
    expect(team.body.memberCount).toBe(1);
    expect(team.body.roster[0].isCaptain).toBe(true);

    // Take a real slot off the availability grid rather than inventing a time.
    const availability = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1 })
      .expect(200);
    const slot = availability.body.pitches[0].slots.find((s: { available: boolean }) => s.available);
    expect(slot).toBeTruthy();

    const booking = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ pitchId, teamId: team.body.id, startsAt: slot.startsAt, duration: 1 })
      .expect(201);

    expect(booking.body.teamName).toBe("Warriors FC");
    expect(booking.body.totalAmount).toBe(55);
    expect(booking.body.depositAmount).toBe(11); // 20% of 55
    expect(booking.body.status).toBe("held");
    expect(booking.body.holdExpiresAt).toBeTruthy();

    // The slot the app just took must disappear from the next grid it draws.
    const after = await request(app)
      .get(`/api/v1/venues/${venue.id}/availability`)
      .query({ date: tomorrow(), duration: 1 });
    const same = after.body.pitches[0].slots.find((s: { startsAt: string }) => s.startsAt === slot.startsAt);
    expect(same.available).toBe(false);
    expect(same.reason).toBe("booked");

    // And it shows up in Profile's booking history.
    const mine = await request(app).get("/api/v1/me/bookings").set("Authorization", `Bearer ${token}`);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].venueName).toBe("City Fields");
  });

  it("reports SLOT_TAKEN when someone else takes the slot first", async () => {
    const venue = await seedVenue();
    const pitchId = String(venue.pitches[0]!._id);
    const startsAt = fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString();

    const player = async (email: string) => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email, password: "Kalimera123", fullName: email.split("@")[0] });
      const team = await request(app)
        .post("/api/v1/teams")
        .set("Authorization", `Bearer ${res.body.accessToken}`)
        .send({ name: `${email.split("@")[0]} FC` });
      return { token: res.body.accessToken as string, teamId: team.body.id as string };
    };

    const first = await player("first@paizeiscy.com");
    const second = await player("second@paizeiscy.com");

    await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${first.token}`)
      .send({ pitchId, teamId: first.teamId, startsAt, duration: 1 })
      .expect(201);

    const clash = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${second.token}`)
      .send({ pitchId, teamId: second.teamId, startsAt, duration: 1 });

    // The app turns this into "That slot has just been taken. Pick another."
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe("SLOT_TAKEN");
  });

  it("refuses to book with someone else's team", async () => {
    const venue = await seedVenue();
    const pitchId = String(venue.pitches[0]!._id);

    const owner = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "owner@paizeiscy.com", password: "Kalimera123", fullName: "Owner" });
    const team = await request(app)
      .post("/api/v1/teams")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ name: "Private FC" });

    const outsider = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "outsider@paizeiscy.com", password: "Kalimera123", fullName: "Outsider" });

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${outsider.body.accessToken}`)
      .send({
        pitchId,
        teamId: team.body.id,
        startsAt: fromZonedTime(`${tomorrow()}T19:00:00`, VENUE_TIMEZONE).toISOString(),
        duration: 1,
      });

    expect(res.status).toBe(403);
  });
});
