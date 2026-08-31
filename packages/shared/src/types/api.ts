/**
 * Error envelope. Every non-2xx response from the API has this body, so clients
 * have one place to translate failures into UI copy.
 */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level messages from Zod, keyed by path. */
    details?: Record<string, string[]>;
  };
}

export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "SLOT_TAKEN",
  "RATE_LIMITED",
  "PAYMENT_FAILED",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
