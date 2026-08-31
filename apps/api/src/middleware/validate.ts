import type { RequestHandler } from "express";
import type { ZodTypeAny, z } from "zod";

/**
 * Validation middleware. Each parses one part of the request and stores the
 * result on `res.locals`, so controllers only ever read validated, coerced,
 * trimmed data — the raw `req.body`/`req.query` is not to be trusted past here.
 *
 * Body is written back to `req.body` (still writable in Express 5); query and
 * params are not, because Express 5 exposes them as getters.
 */
export const validateBody =
  <S extends ZodTypeAny>(schema: S): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    res.locals.body = result.data;
    next();
  };

export const validateQuery =
  <S extends ZodTypeAny>(schema: S): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    res.locals.query = result.data;
    next();
  };

export const validateParams =
  <S extends ZodTypeAny>(schema: S): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(result.error);
    res.locals.params = result.data;
    next();
  };

/**
 * Typed read-back of what the middleware parsed, e.g.
 * `const q = parsed<typeof venueQuerySchema>(res, "query")`.
 */
export function parsed<S extends ZodTypeAny>(
  res: { locals: Record<string, unknown> },
  part: "body" | "query" | "params",
): z.infer<S> {
  return res.locals[part] as z.infer<S>;
}

/**
 * Reads a path parameter as a string.
 *
 * Express 5 types params as `string | string[]`, because a route can declare a
 * repeated segment. Ours never do, so this narrows once here instead of a cast
 * at every call site.
 */
export function pathParam(req: { params: Record<string, string | string[] | undefined> }, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
