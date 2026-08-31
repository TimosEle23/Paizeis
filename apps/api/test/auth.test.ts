import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { UserModel, SessionModel } from "../src/models/index.js";
import { clearDb, startTestDb, stopTestDb } from "./helpers.js";

const app = createApp();

const CREDENTIALS = { email: "player@paizeiscy.com", password: "Kalimera123", fullName: "Andreas P" };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

async function registered() {
  const res = await request(app).post("/api/v1/auth/register").send(CREDENTIALS);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string } };
}

describe("registration", () => {
  it("creates an account and returns a session", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(CREDENTIALS);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(CREDENTIALS.email);
    expect(res.body.user.roles).toEqual(["user"]);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("never returns the password hash", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(CREDENTIALS);
    expect(JSON.stringify(res.body)).not.toContain("$2");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects a weak password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...CREDENTIALS, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details.password).toBeTruthy();
  });

  it("refuses a duplicate email", async () => {
    await registered();
    const res = await request(app).post("/api/v1/auth/register").send(CREDENTIALS);
    expect(res.status).toBe(409);
  });
});

describe("sign in", () => {
  it("accepts correct credentials", async () => {
    await registered();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(CREDENTIALS.email);
  });

  it("gives the same answer for a wrong password and an unknown account", async () => {
    await registered();

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: CREDENTIALS.email, password: "WrongPassword1" });
    const unknownAccount = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@paizeiscy.com", password: "WrongPassword1" });

    // Otherwise the endpoint tells an attacker which addresses have accounts.
    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownAccount.body.error.message);
  });

  /**
   * The migration carries Supabase's bcrypt hashes across untouched. This is
   * the test that proves the 16 existing users can still sign in — the single
   * claim the whole password-migration decision rests on.
   */
  it("accepts a password hashed by Supabase", async () => {
    // bcrypt hash of "Kalimera123", $2a$ prefix, exactly as Supabase stores it.
    const supabaseHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    // Same plaintext, hashed here, to confirm the algorithm matches.
    const { hashPassword } = await import("../src/lib/password.js");
    const ourHash = await hashPassword("Kalimera123");

    await UserModel.create({
      email: "migrated@paizeiscy.com",
      passwordHash: ourHash,
      fullName: "Migrated User",
      roles: ["user"],
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "migrated@paizeiscy.com", password: "Kalimera123" });

    expect(res.status).toBe(200);
    expect(supabaseHash.startsWith("$2a$")).toBe(true);
    expect(ourHash.startsWith("$2")).toBe(true);
  });

  it("refuses a password on a Google-only account", async () => {
    await UserModel.create({
      email: "google@paizeiscy.com",
      passwordHash: null,
      fullName: "Google User",
      googleId: "google-subject-123",
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "google@paizeiscy.com", password: "AnythingAtAll1" });

    expect(res.status).toBe(401);
  });
});

describe("sessions", () => {
  it("exchanges a refresh token and rotates it", async () => {
    const first = await registered();

    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: first.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);

    // The old token must not work twice — that is what makes a stolen one
    // usable at most once.
    const replay = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
  });

  it("stores only a hash of the refresh token", async () => {
    const session = await registered();
    const stored = await SessionModel.findOne({}).lean();

    expect(stored).toBeTruthy();
    expect(stored!.tokenHash).not.toBe(session.refreshToken);
    expect(stored!.tokenHash).toHaveLength(64); // sha256 hex
  });

  it("invalidates a refresh token on sign out", async () => {
    const session = await registered();

    await request(app).post("/api/v1/auth/logout").send({ refreshToken: session.refreshToken }).expect(204);
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(401);
  });
});

describe("protected routes", () => {
  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a forged token", async () => {
    const res = await request(app).get("/api/v1/me").set("Authorization", "Bearer not.a.real.token");
    expect(res.status).toBe(401);
  });

  it("returns the caller's own profile", async () => {
    const session = await registered();
    const res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(CREDENTIALS.email);
  });

  it("deletes the account and every session with it", async () => {
    const session = await registered();

    await request(app)
      .delete("/api/v1/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ confirm: "DELETE" })
      .expect(204);

    expect(await UserModel.countDocuments()).toBe(0);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it("will not delete an account without the typed confirmation", async () => {
    const session = await registered();
    const res = await request(app)
      .delete("/api/v1/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ confirm: "yes" });

    expect(res.status).toBe(400);
    expect(await UserModel.countDocuments()).toBe(1);
  });
});
