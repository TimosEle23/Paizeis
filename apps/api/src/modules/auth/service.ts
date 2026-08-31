import { Types } from "mongoose";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type {
  AppleSignInInput, AuthResponse, GoogleSignInInput, Role,
  SignInInput, SignUpInput, UserDto,
} from "@paizeis/shared";
import { env, googleClientIds } from "../../config/env.js";
import { ApiError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  accessTokenLifetimeSeconds, generateRefreshToken, hashRefreshToken, signAccessToken,
} from "../../lib/tokens.js";
import { SessionModel, UserModel, type UserDoc } from "../../models/index.js";

export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

export function toUserDto(user: UserDoc): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    phone: user.phone ?? null,
    location: user.location ?? null,
    roles: (user.roles ?? ["user"]) as Role[],
    createdAt: (user.get("createdAt") as Date).toISOString(),
  };
}

/** Issues an access token plus a fresh, stored refresh session. */
async function issueSession(user: UserDoc, context: SessionContext): Promise<AuthResponse> {
  const refresh = generateRefreshToken();

  await SessionModel.create({
    userId: user._id,
    tokenHash: refresh.hash,
    userAgent: context.userAgent ?? null,
    ip: context.ip ?? null,
    expiresAt: refresh.expiresAt,
  });

  user.lastSignInAt = new Date();
  await user.save();

  return {
    accessToken: signAccessToken({
      sub: user.id,
      email: user.email,
      roles: (user.roles ?? ["user"]) as Role[],
    }),
    expiresIn: accessTokenLifetimeSeconds(),
    refreshToken: refresh.token,
    user: toUserDto(user),
  };
}

export async function register(input: SignUpInput, context: SessionContext): Promise<AuthResponse> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    // Deliberately explicit: the sign-up form has to say something useful, and
    // an attacker learns the same thing from the password-reset flow anyway.
    throw ApiError.conflict("An account with that email already exists");
  }

  const user = await UserModel.create({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    fullName: input.fullName,
    roles: ["user"],
  });

  return issueSession(user, context);
}

export async function signIn(input: SignInInput, context: SessionContext): Promise<AuthResponse> {
  const user = await UserModel.findOne({ email: input.email });
  const ok = await verifyPassword(input.password, user?.passwordHash);

  // One message for both "no such account" and "wrong password", so the
  // endpoint cannot be used to enumerate who has an account.
  if (!user || !ok) throw ApiError.unauthenticated("Email or password is incorrect");

  return issueSession(user, context);
}

/**
 * Refresh with rotation: the presented token is revoked as the new one is
 * issued, so a stolen refresh token is usable at most once before the real
 * user's next refresh invalidates it.
 */
export async function refresh(token: string, context: SessionContext): Promise<AuthResponse> {
  const session = await SessionModel.findOne({ tokenHash: hashRefreshToken(token) });

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthenticated("Session expired. Sign in again");
  }

  const user = await UserModel.findById(session.userId);
  if (!user) throw ApiError.unauthenticated("Session expired. Sign in again");

  session.revokedAt = new Date();
  await session.save();

  return issueSession(user, context);
}

export async function signOut(token: string): Promise<void> {
  await SessionModel.updateOne(
    { tokenHash: hashRefreshToken(token), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/** Revokes every session for a user — "log me out everywhere", and used on password change. */
export async function signOutEverywhere(userId: Types.ObjectId): Promise<void> {
  await SessionModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

const googleClient = new OAuth2Client();

/**
 * Google Sign-In. The client sends the ID token; the server verifies the
 * signature and audience rather than trusting any claim the app passes up.
 *
 * Accounts migrated from Supabase have no stored Google subject id, so the
 * first Google sign-in matches on the verified email address and links the two
 * from then on. Only a Google-verified email is trusted for that link — without
 * that check, anyone could claim an existing account.
 */
export async function signInWithGoogle(input: GoogleSignInInput, context: SessionContext): Promise<AuthResponse> {
  if (googleClientIds.length === 0) {
    throw ApiError.internal("Google Sign-In is not configured");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: input.idToken,
    audience: googleClientIds,
  }).catch(() => {
    throw ApiError.unauthenticated("Google sign-in failed");
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw ApiError.unauthenticated("Google sign-in failed");
  if (!payload.email_verified) throw ApiError.unauthenticated("Your Google email is not verified");

  const email = payload.email.toLowerCase();
  let user = await UserModel.findOne({ $or: [{ googleId: payload.sub }, { email }] });

  if (!user) {
    user = await UserModel.create({
      email,
      fullName: payload.name ?? email.split("@")[0],
      avatarUrl: payload.picture ?? null,
      googleId: payload.sub,
      emailVerifiedAt: new Date(),
      roles: ["user"],
    });
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    user.emailVerifiedAt ??= new Date();
    await user.save();
  }

  return issueSession(user, context);
}

const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

/**
 * Sign in with Apple — required by App Store guideline 4.8 because the app
 * offers Google sign-in.
 *
 * Apple returns the user's name only on the very first authorization, so the
 * client forwards it and it is stored once. Apple's private relay addresses
 * (@privaterelay.appleid.com) are real, deliverable addresses and are treated
 * as ordinary emails.
 */
export async function signInWithApple(input: AppleSignInInput, context: SessionContext): Promise<AuthResponse> {
  if (!env.APPLE_BUNDLE_ID) throw ApiError.internal("Sign in with Apple is not configured");

  const { payload } = await jwtVerify(input.identityToken, appleKeys, {
    issuer: "https://appleid.apple.com",
    audience: env.APPLE_BUNDLE_ID,
  }).catch(() => {
    throw ApiError.unauthenticated("Apple sign-in failed");
  });

  const appleId = payload.sub;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  if (!appleId) throw ApiError.unauthenticated("Apple sign-in failed");

  let user = await UserModel.findOne(email ? { $or: [{ appleId }, { email }] } : { appleId });

  if (!user) {
    if (!email) throw ApiError.unauthenticated("Apple did not provide an email address");
    user = await UserModel.create({
      email,
      fullName: input.fullName ?? email.split("@")[0],
      appleId,
      emailVerifiedAt: new Date(),
      roles: ["user"],
    });
  } else if (!user.appleId) {
    user.appleId = appleId;
    await user.save();
  }

  return issueSession(user, context);
}
