import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

let replSet: MongoMemoryReplSet | null = null;

/**
 * A real MongoDB for tests, as a single-node replica set — a standalone cannot
 * run the transactions the booking path depends on, so tests on a standalone
 * would pass while production behaviour differed.
 */
export async function startTestDb(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: "paizeis-test", storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replSet.getUri(), { dbName: "paizeis_test" });
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await replSet?.stop();
  replSet = null;
}

export async function clearDb(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
