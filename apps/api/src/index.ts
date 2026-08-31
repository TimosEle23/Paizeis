import { createApp } from "./app.js";
import { env, isProduction } from "./config/env.js";
import { connectMongo, disconnectMongo, supportsTransactions } from "./db/mongo.js";
import { logger } from "./lib/logger.js";

/**
 * "memory" spins up a local replica set so the stack runs with no external
 * setup. Refused in production, where a real cluster is the only valid answer.
 */
async function resolveMongoUri(): Promise<string> {
  if (env.MONGODB_URI !== "memory") return env.MONGODB_URI;
  if (isProduction) {
    throw new Error('MONGODB_URI="memory" is not allowed in production — point it at a real cluster');
  }
  const { startMemoryMongo } = await import("./db/memoryServer.js");
  return startMemoryMongo();
}

async function main(): Promise<void> {
  await connectMongo(await resolveMongoUri());

  if (!supportsTransactions()) {
    // Booking creation relies on a transaction to stop double-booking.
    logger.warn("mongo deployment does not support transactions — booking writes are not atomic here");
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "paizeis api listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(async () => {
      await disconnectMongo();
      if (env.MONGODB_URI === "memory") {
        const { stopMemoryMongo } = await import("./db/memoryServer.js");
        await stopMemoryMongo();
      }
      process.exit(0);
    });
    // Render sends SIGTERM and waits 30s; don't hang past that.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
