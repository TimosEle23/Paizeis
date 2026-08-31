import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * An emailed invitation to a team, a booking or a tournament.
 *
 * The token is what arrives in the link, so it is indexed and unique; a TTL
 * index removes invitations once they expire rather than leaving dead links
 * that resolve to a confusing error.
 */
const invitationSchema = new Schema(
  {
    token: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    type: { type: String, required: true, enum: ["team", "booking", "tournament"] },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament", default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

invitationSchema.index({ token: 1 }, { unique: true });
invitationSchema.index({ email: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Invitation = InferSchemaType<typeof invitationSchema>;
export const InvitationModel = model("Invitation", invitationSchema);
