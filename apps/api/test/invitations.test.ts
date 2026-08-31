import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { addDays } from "date-fns";
import { format, fromZonedTime, toZonedTime } from "date-fns-tz";
import { VENUE_TIMEZONE } from "@paizeis/shared";
import { createApp } from "../src/app.js";
import { TeamModel, VenueModel } from "../src/models/index.js";
import { clearDb, startTestDb, stopTestDb } from "./helpers.js";

/**
 * Inviting a player to a specific match, and their reply.
 *
 * Expo's push endpoint is stubbed: whether a phone buzzed is not this suite's
 * business, and a test that reaches the public internet is a test that fails on
 * a train.
 */
const app = createApp();

beforeAll(async () => {
  await startTestDb();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await stopTestDb();
});
beforeEach(clearDb);

const tomorrow = () =>
  format(toZonedTime(addDays(new Date(), 1), VENUE_TIMEZONE), "yyyy-MM-dd", { timeZone: VENUE_TIMEZONE });

async function player(email: string) {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Kalimera123", fullName: email.split("@")[0] });
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}

async function bookedMatch() {
  const venue = await VenueModel.create({
    name: "Alana Sports Center", city: "Paphos", location: "Geroskipou",
    openingHours: { open: "09:00", close: "21:00" }, depositRate: 0.2,
    pitches: [{ name: "Mini Football Pitch 1", pitchType: "5v5", pricePerHour: 45, isAvailable: true }],
  });
  const captain = await player("captain@paizeiscy.com");
  const team = await request(app)
    .post("/api/v1/teams").set("Authorization", `Bearer ${captain.token}`).send({ name: "Warriors FC" });
  const booking = await request(app)
    .post("/api/v1/bookings").set("Authorization", `Bearer ${captain.token}`)
    .send({
      pitchId: String(venue.pitches[0]!._id),
      teamId: team.body.id,
      startsAt: fromZonedTime(`${tomorrow()}T18:00:00`, VENUE_TIMEZONE).toISOString(),
      duration: 1,
    })
    .expect(201);
  return { captain, teamId: team.body.id as string, bookingId: booking.body.id as string };
}

describe("match invitations", () => {
  it("invites a player and puts them on the team sheet", async () => {
    const { captain, bookingId } = await bookedMatch();
    await player("winger@paizeiscy.com");

    const res = await request(app)
      .post(`/api/v1/bookings/${bookingId}/invitations`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: "winger@paizeiscy.com" })
      .expect(201);

    expect(res.body.venueName).toBe("Alana Sports Center");
    expect(res.body.status).toBe("pending");

    const booking = await request(app)
      .get(`/api/v1/bookings/${bookingId}`).set("Authorization", `Bearer ${captain.token}`);
    expect(booking.body.players).toContain("winger@paizeiscy.com");
  });

  it("shows the invitation to the person invited", async () => {
    const { captain, bookingId } = await bookedMatch();
    const winger = await player("winger@paizeiscy.com");

    await request(app)
      .post(`/api/v1/bookings/${bookingId}/invitations`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: "winger@paizeiscy.com" });

    const mine = await request(app).get("/api/v1/invitations").set("Authorization", `Bearer ${winger.token}`);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].invitedByName).toBe("captain");
    expect(mine.body[0].status).toBe("pending");
  });

  it("adds an accepting player to the roster", async () => {
    const { captain, teamId, bookingId } = await bookedMatch();
    const winger = await player("winger@paizeiscy.com");

    const invitation = await request(app)
      .post(`/api/v1/bookings/${bookingId}/invitations`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: "winger@paizeiscy.com" });

    await request(app)
      .post(`/api/v1/invitations/${invitation.body.id}/accept`)
      .set("Authorization", `Bearer ${winger.token}`)
      .expect(200);

    const team = await TeamModel.findById(teamId).lean();
    expect(team!.roster.some((entry) => String(entry.userId) === winger.id)).toBe(true);
  });

  it("takes a declining player off the match sheet", async () => {
    const { captain, bookingId } = await bookedMatch();
    const winger = await player("winger@paizeiscy.com");

    const invitation = await request(app)
      .post(`/api/v1/bookings/${bookingId}/invitations`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: "winger@paizeiscy.com" });

    await request(app)
      .post(`/api/v1/invitations/${invitation.body.id}/decline`)
      .set("Authorization", `Bearer ${winger.token}`)
      .expect(200);

    const booking = await request(app)
      .get(`/api/v1/bookings/${bookingId}`).set("Authorization", `Bearer ${captain.token}`);
    expect(booking.body.players).not.toContain("winger@paizeiscy.com");
  });

  it("refuses to let an outsider invite people to someone else's match", async () => {
    const { bookingId } = await bookedMatch();
    const outsider = await player("outsider@paizeiscy.com");

    const res = await request(app)
      .post(`/api/v1/bookings/${bookingId}/invitations`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ email: "someone@paizeiscy.com" });

    expect(res.status).toBe(403);
  });

  it("hides an invitation addressed to someone else", async () => {
    const { captain, bookingId } = await bookedMatch();
    await player("winger@paizeiscy.com");
    const nosy = await player("nosy@paizeiscy.com");

    const invitation = await request(app)
      .post(`/api/v1/bookings/${bookingId}/invitations`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: "winger@paizeiscy.com" });

    // 404, not 403 — a stranger must not learn the invitation exists.
    await request(app)
      .post(`/api/v1/invitations/${invitation.body.id}/accept`)
      .set("Authorization", `Bearer ${nosy.token}`)
      .expect(404);
  });

  it("will not invite the same person twice", async () => {
    const { captain, bookingId } = await bookedMatch();
    await player("winger@paizeiscy.com");

    const invite = () =>
      request(app)
        .post(`/api/v1/bookings/${bookingId}/invitations`)
        .set("Authorization", `Bearer ${captain.token}`)
        .send({ email: "winger@paizeiscy.com" });

    await invite().expect(201);
    await invite().expect(409);
  });
});
