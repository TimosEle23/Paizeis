import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A message in a team's chat.
 *
 * Its own collection rather than an array on the team: a squad chats
 * indefinitely, and an unbounded array inside a document eventually hits
 * MongoDB's 16 MB limit and makes every roster read heavier.
 */
const teamMessageSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

// Backs the only query there is: this team's messages, newest first.
teamMessageSchema.index({ teamId: 1, createdAt: -1 });

export type TeamMessage = InferSchemaType<typeof teamMessageSchema>;
export const TeamMessageModel = model("TeamMessage", teamMessageSchema);
