import { z } from "zod";
import { objectId } from "./common";
import { emailField } from "./auth";

export const teamNameField = z
  .string()
  .trim()
  .min(1, { message: "Team name is required" })
  .max(100, { message: "Team name must be less than 100 characters" });

export const createTeamSchema = z.object({ name: teamNameField });
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({ name: teamNameField.optional() });
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

/** Add by existing user id, or invite by email — the web flow allowed both. */
export const addRosterMemberSchema = z
  .object({
    userId: objectId.optional(),
    email: emailField.optional(),
    position: z.string().trim().max(50).optional(),
  })
  .refine((v) => Boolean(v.userId || v.email), {
    message: "Provide a user id or an email address",
  });
export type AddRosterMemberInput = z.infer<typeof addRosterMemberSchema>;

export const invitationSchema = z.object({
  email: emailField,
  type: z.enum(["team", "booking", "tournament"]),
  teamId: objectId.optional(),
  bookingId: objectId.optional(),
  tournamentId: objectId.optional(),
});
export type InvitationInput = z.infer<typeof invitationSchema>;
