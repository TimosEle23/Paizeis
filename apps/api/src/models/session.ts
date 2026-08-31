import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A refresh-token session. Storing them server-side is what makes sign-out and
 * "log me out everywhere" real rather than advisory — a stateless refresh token
 * cannot be revoked before it expires.
 *
 * Only a SHA-256 hash of the token is kept, so a database leak does not hand
 * over working sessions.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Expo push registrations, one per install. */
const deviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expoPushToken: { type: String, required: true },
    platform: { type: String, required: true, enum: ["ios", "android", "web"] },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
deviceSchema.index({ expoPushToken: 1 }, { unique: true });
deviceSchema.index({ userId: 1 });

export type Session = InferSchemaType<typeof sessionSchema>;
export const SessionModel = model("Session", sessionSchema);
export const DeviceModel = model("Device", deviceSchema);
