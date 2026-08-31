import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { corsOrigins, isTest } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { ApiError } from "./lib/errors.js";
import { apiRouter } from "./routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";

export function createApp(): Express {
  const app = express();

  // Render and other proxies terminate TLS; without this the rate limiter sees
  // one client IP for the whole internet.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Native apps and server-to-server calls send no Origin header.
        if (!origin || corsOrigins.includes(origin)) return callback(null, true);
        // An ApiError, not a bare Error — otherwise a misconfigured origin looks
        // like a server bug: a logged 500 instead of an actionable 403.
        callback(ApiError.forbidden(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    }),
  );

  if (!isTest) app.use(pinoHttp({ logger }));

  /**
   * Stripe signs the raw bytes, so the webhook route must see the unparsed body.
   * It is mounted before the JSON parser and reads `req.rawBody`.
   */
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  /**
   * Media — hero videos, backgrounds, venue photos.
   *
   * These were served by Lovable's CDN and now live in the repo. Serving them
   * from the API means the phone can reach them over the LAN during
   * development. In production they move to Cloudflare R2 and this route stops
   * being used; MEDIA_ROOT exists so that switch is a config change.
   */
  const mediaRoot = resolve(process.cwd(), "../web/public");
  if (existsSync(mediaRoot)) {
    app.use("/media", express.static(resolve(mediaRoot, "media"), { maxAge: "1h" }));
    app.use("/images", express.static(resolve(mediaRoot, "images"), { maxAge: "1h" }));
  }

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
