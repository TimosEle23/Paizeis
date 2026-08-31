import type { Types } from "mongoose";
import type { Role } from "@paizeis/shared";

/**
 * The authenticated caller. Services take this as their first argument — the
 * convention that replaces "the database decides who can see what".
 */
export interface Actor {
  id: Types.ObjectId;
  email: string;
  roles: Role[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Present only after `authenticate` has run. */
      actor?: Actor;
    }
  }
}
