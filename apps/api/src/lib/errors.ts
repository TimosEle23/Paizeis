import type { ApiErrorCode } from "@paizeis/shared";

/**
 * The only error type controllers and services should throw. The error handler
 * turns it into the shared ApiErrorBody envelope; anything else becomes a 500
 * with no detail, so internal messages never reach a client.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, string[]>;

  constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, string[]>) {
    return new ApiError(400, "VALIDATION_FAILED", message, details);
  }

  static unauthenticated(message = "Sign in to continue") {
    return new ApiError(401, "UNAUTHENTICATED", message);
  }

  static tokenExpired(message = "Session expired") {
    return new ApiError(401, "TOKEN_EXPIRED", message);
  }

  /**
   * Used when the actor is known but not permitted. Prefer notFound() for
   * resources the actor should not even learn the existence of.
   */
  static forbidden(message = "You do not have access to this") {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(message: string) {
    return new ApiError(409, "CONFLICT", message);
  }

  /** The slot was taken between rendering availability and confirming. */
  static slotTaken(message = "That slot has just been taken") {
    return new ApiError(409, "SLOT_TAKEN", message);
  }

  static rateLimited(message = "Too many attempts. Try again shortly") {
    return new ApiError(429, "RATE_LIMITED", message);
  }

  static internal(message = "Something went wrong") {
    return new ApiError(500, "INTERNAL", message);
  }
}
