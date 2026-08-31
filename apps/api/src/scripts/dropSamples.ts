/**
 * Drops the Atlas sample datasets, which are loaded by default at cluster
 * creation and consume a large share of the 512 MB free tier.
 *
 *   npm run db:drop-samples --workspace @paizeis/api
 *
 * It will only ever drop databases whose name begins with "sample_". Anything
 * else is refused — this script must never become a way to lose real data.
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectMongo, disconnectMongo } from "../db/mongo.js";

const SAMPLE_PREFIX = "sample_";

async function main(): Promise<void> {
  if (env.MONGODB_URI === "memory") {
    console.log("MONGODB_URI=memory — nothing to drop on a throwaway database.");
    return;
  }

  await connectMongo();
  const client = mongoose.connection.getClient();
  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();

  const samples = databases.filter((db) => db.name.startsWith(SAMPLE_PREFIX));

  if (samples.length === 0) {
    console.log("No sample databases found. Nothing to do.");
    await disconnectMongo();
    return;
  }

  let reclaimedMb = 0;
  for (const db of samples) {
    // Belt and braces: the filter above already guarantees this, but dropping
    // databases is not something to leave to a single condition.
    if (!db.name.startsWith(SAMPLE_PREFIX)) continue;

    const mb = (db.sizeOnDisk ?? 0) / 1024 / 1024;
    await client.db(db.name).dropDatabase();
    reclaimedMb += mb;
    console.log(`dropped ${db.name} (${mb.toFixed(1)} MB)`);
  }

  console.log(`\nreclaimed ${reclaimedMb.toFixed(1)} MB`);
  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
