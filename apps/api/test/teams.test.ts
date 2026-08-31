import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { TeamModel } from "../src/models/index.js";
import { clearDb, startTestDb, stopTestDb } from "./helpers.js";

/** Squad management and team chat. Push is stubbed; delivery is not this suite's job. */
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

async function player(email: string) {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Kalimera123", fullName: email.split("@")[0] });
  return { token: res.body.accessToken as string, id: res.body.user.id as string, email };
}

async function teamWithCaptain() {
  const captain = await player("captain@paizeiscy.com");
  const team = await request(app)
    .post("/api/v1/teams").set("Authorization", `Bearer ${captain.token}`).send({ name: "Warriors FC" });
  return { captain, teamId: team.body.id as string };
}

describe("squad management", () => {
  it("adds a player by email", async () => {
    const { captain, teamId } = await teamWithCaptain();
    await player("winger@paizeiscy.com");

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: "winger@paizeiscy.com" })
      .expect(201);

    expect(res.body.memberCount).toBe(2);
    expect(res.body.roster.map((m: { email: string }) => m.email)).toContain("winger@paizeiscy.com");
  });

  it("will not add someone without an account", async () => {
    const { captain, teamId } = await teamWithCaptain();
    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: "ghost@paizeiscy.com" });

    expect(res.status).toBe(404);
  });

  it("lets only the captain change the squad", async () => {
    const { captain, teamId } = await teamWithCaptain();
    const winger = await player("winger@paizeiscy.com");
    await request(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: winger.email });

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set("Authorization", `Bearer ${winger.token}`)
      .send({ email: "someone@paizeiscy.com" });

    expect(res.status).toBe(403);
  });

  it("hides a team from someone who is not on it", async () => {
    const { teamId } = await teamWithCaptain();
    const outsider = await player("outsider@paizeiscy.com");

    // 404, not 403 — a stranger must not learn the team exists.
    await request(app)
      .get(`/api/v1/teams/${teamId}`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(404);
  });

  it("refuses to remove the captain", async () => {
    const { captain, teamId } = await teamWithCaptain();
    const res = await request(app)
      .delete(`/api/v1/teams/${teamId}/members/${captain.id}`)
      .set("Authorization", `Bearer ${captain.token}`);

    expect(res.status).toBe(409);
  });

  it("hands the captaincy on when the captain leaves", async () => {
    const { captain, teamId } = await teamWithCaptain();
    const winger = await player("winger@paizeiscy.com");
    await request(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: winger.email });

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/leave`)
      .set("Authorization", `Bearer ${captain.token}`)
      .expect(200);

    expect(res.body.teamDeleted).toBe(false);
    const team = await TeamModel.findById(teamId).lean();
    expect(String(team!.captainId)).toBe(winger.id);
  });

  it("deletes the team when the last member leaves", async () => {
    const { captain, teamId } = await teamWithCaptain();

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/leave`)
      .set("Authorization", `Bearer ${captain.token}`)
      .expect(200);

    expect(res.body.teamDeleted).toBe(true);
    expect(await TeamModel.findById(teamId)).toBeNull();
  });
});

describe("team chat", () => {
  it("posts and reads messages oldest first", async () => {
    const { captain, teamId } = await teamWithCaptain();

    await request(app)
      .post(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ body: "Who's in for Thursday?" })
      .expect(201);
    await request(app)
      .post(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ body: "18:00 at City Fields" })
      .expect(201);

    const res = await request(app)
      .get(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${captain.token}`);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].body).toBe("Who's in for Thursday?");
    expect(res.body[0].mine).toBe(true);
    expect(res.body[0].authorName).toBe("captain");
  });

  it("marks a teammate's message as not mine", async () => {
    const { captain, teamId } = await teamWithCaptain();
    const winger = await player("winger@paizeiscy.com");
    await request(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ email: winger.email });

    await request(app)
      .post(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ body: "Bring bibs" });

    const res = await request(app)
      .get(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${winger.token}`);

    expect(res.body[0].mine).toBe(false);
    expect(res.body[0].authorName).toBe("captain");
  });

  it("keeps the chat private to the squad", async () => {
    const { captain, teamId } = await teamWithCaptain();
    const outsider = await player("outsider@paizeiscy.com");

    await request(app)
      .post(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ body: "Private planning" });

    await request(app)
      .get(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(404);

    await request(app)
      .post(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ body: "Let me in" })
      .expect(404);
  });

  it("rejects an empty message", async () => {
    const { captain, teamId } = await teamWithCaptain();
    await request(app)
      .post(`/api/v1/teams/${teamId}/messages`)
      .set("Authorization", `Bearer ${captain.token}`)
      .send({ body: "   " })
      .expect(400);
  });
});
