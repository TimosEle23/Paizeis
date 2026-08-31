import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@paizeis/shared";
import { ApiError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { isProduction } from "../config/env.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.path}`));
};

function zodDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Terminal error handler. Anything that is not an ApiError is treated as a bug:
 * logged in full, reported to the client as a bare 500.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = ApiError.badRequest("Check the highlighted fields", zodDetails(err));
  } else if (isDuplicateKeyError(err)) {
    apiError = ApiError.conflict("That already exists");
  } else {
    apiError = ApiError.internal();
    logger.error({ err, path: req.path, method: req.method }, "unhandled error");
  }

  if (apiError.status >= 500 && !(err instanceof ApiError)) {
    // already logged above
  } else if (apiError.status >= 500) {
    logger.error({ err, path: req.path }, "server error");
  }

  const body: ApiErrorBody = {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  };

  if (!isProduction && apiError.status >= 500 && err instanceof Error) {
    (body.error as Record<string, unknown>).stack = err.stack;
  }

  res.status(apiError.status).json(body);
};

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
