import { logger } from "../lib/logger.js";

/**
 * Local development MongoDB, started in-process when MONGODB_URI is "memory".
 *
 * It runs as a single-node *replica set* rather than a standalone, because
 * booking creation depends on a transaction and a standalone mongod cannot run
 * one — a dev database that silently lacked transactions would hide the exact
 * bug this rebuild exists to fix.
 *
 * Storage is ephemeral: every restart starts empty. Persisting to a fixed
 * dbPath does not work here, because the replica-set config records the port
 * and the server picks a fresh one on each boot, so a restart fails to rejoin
 * its own stored configuration. Point MONGODB_URI at Atlas when data needs to
 * survive; use the seed script for repeatable local fixtures.
 *
 * This module is imported dynamically and never reaches a production bundle.
 */
let instance: { stop: () => Promise<unknown> } | null = null;

export async function startMemoryMongo(): Promise<string> {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: "paizeis-dev", storageEngine: "wiredTiger" },
  });

  instance = replSet;
  const uri = replSet.getUri();
  logger.info("local mongo replica set started — transactions available, data is not persisted");
  return uri;
}

export async function stopMemoryMongo(): Promise<void> {
  await instance?.stop();
  instance = null;
}
