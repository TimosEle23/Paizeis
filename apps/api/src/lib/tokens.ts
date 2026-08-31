import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import type { Role } from "@paizeis/shared";
import { env } from "../config/env.js";
import { ApiError } from "./errors.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: Role[];
}

/** Short-lived, stateless. Revocation is handled by the refresh token, not this. */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: "paizeis-api",
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "paizeis-api" }) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw ApiError.tokenExpired();
    throw ApiError.unauthenticated("Invalid token");
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs, and only their SHA-256
 * hash is stored. A stateless refresh token cannot be revoked before it
 * expires, which would make "sign out" and "log me out everywhere" cosmetic.
 */
export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(48).toString("base64url");
  return {
    token,
    hash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000),
  };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Seconds until an access token expires, for the client's refresh timer. */
export function accessTokenLifetimeSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.ACCESS_TOKEN_TTL);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  return value * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
}

export function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound();
  return new Types.ObjectId(id);
}
