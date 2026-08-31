import mongoose from "mongoose";
import { env, isProduction } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * A single connection for the process. Atlas M0 caps connections at 500, and a
 * sleeping Render instance reconnects on wake, so keep the pool small and let
 * the driver buffer during the reconnect rather than failing requests.
 */
export async function connectMongo(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  if (!isProduction) mongoose.set("debug", false);

  mongoose.connection.on("connected", () => logger.info("mongo connected"));
  mongoose.connection.on("disconnected", () => logger.warn("mongo disconnected"));
  mongoose.connection.on("error", (err) => logger.error({ err }, "mongo error"));

  await mongoose.connect(uri, {
    dbName: env.MONGODB_DB_NAME,
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10_000,
    retryWrites: true,
  });

  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.connection.close();
}

/**
 * True when the deployment can run multi-document transactions. Atlas (a
 * replica set) can; a bare standalone mongod cannot. Booking creation needs
 * this, so it is checked explicitly rather than discovered on first booking.
 */
export function supportsTransactions(): boolean {
  const topology = (mongoose.connection.db?.client as unknown as { topology?: { description?: { type?: string } } })
    ?.topology;
  const type = topology?.description?.type;
  return type === "ReplicaSetWithPrimary" || type === "Sharded" || type === "LoadBalanced";
}
