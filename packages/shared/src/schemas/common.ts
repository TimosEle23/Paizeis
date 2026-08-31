import { z } from "zod";

/** Mongo ObjectId as it appears over the wire. */
export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, { message: "Invalid id" });

/** Calendar day in the venue's local timezone, e.g. "2026-09-14". */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Expected a YYYY-MM-DD date" });

/** Wall-clock time of day, e.g. "18:30". */
export const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Expected a HH:MM time" });

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: objectId.optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;
