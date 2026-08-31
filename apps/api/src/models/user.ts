import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { ROLES } from "@paizeis/shared";

/**
 * One collection for what Supabase split across `auth.users` and `profiles`.
 * There was never a case for two — every profile had exactly one account.
 *
 * `passwordHash` holds a bcrypt hash. The migration carries the existing
 * Supabase hashes across unchanged, which is why current users keep their
 * passwords; new hashes are produced with the same algorithm.
 */
const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    /** Absent for accounts that only ever signed in with Google or Apple. */
    passwordHash: { type: String, default: null },

    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    avatarUrl: { type: String, default: null },
    phone: { type: String, default: null, maxlength: 20 },
    location: { type: String, default: null, maxlength: 200 },

    /**
     * Global roles only. Venue-manager authority is per-venue and lives in the
     * venueManagers collection — putting it here would silently grant a manager
     * authority over every venue.
     */
    roles: { type: [String], enum: ROLES, default: ["user"] },

    /** Provider subject ids, linked on first sign-in with that provider. */
    googleId: { type: String, default: null },
    appleId: { type: String, default: null },

    emailVerifiedAt: { type: Date, default: null },
    lastSignInAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });

/**
 * Partial, not sparse. A sparse unique index only skips documents where the
 * field is *absent*; an explicit `null` still participates, so every account
 * without a Google id would collide with every other one. Restricting the index
 * to string values is what actually expresses "unique among those that have one".
 */
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: "string" } } },
);
userSchema.index(
  { appleId: 1 },
  { unique: true, partialFilterExpression: { appleId: { $type: "string" } } },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model("User", userSchema);
