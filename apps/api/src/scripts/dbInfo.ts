/**
 * Reports which database the API is actually pointed at, and whether it can do
 * what the app needs. Run it after changing MONGODB_URI, or whenever "is this
 * hitting Atlas or my local throwaway?" is in question.
 *
 *   npm run db:info --workspace @paizeis/api
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectMongo, disconnectMongo, supportsTransactions } from "../db/mongo.js";

/** Free-tier storage cap, for the usage line below. */
const M0_LIMIT_MB = 512;

async function main(): Promise<void> {
  const usingMemory = env.MONGODB_URI === "memory";
  if (usingMemory) {
    console.log("MONGODB_URI=memory — this is a throwaway local database, not Atlas.\n");
    return;
  }

  const host = env.MONGODB_URI.split("@")[1]?.split("/")[0] ?? "unknown";
  await connectMongo();

  const admin = mongoose.connection.db!.admin();
  const hello = await admin.command({ hello: 1 });
  const { databases } = await admin.listDatabases();

  console.log(`cluster        ${host}`);
  console.log(`database       ${env.MONGODB_DB_NAME}`);
  console.log(`replica set    ${hello.setName ?? "none"}`);
  console.log(`transactions   ${supportsTransactions() ? "supported" : "NOT SUPPORTED — booking writes would not be atomic"}`);

  console.log("\ndatabases");
  let sampleMb = 0;
  let totalMb = 0;
  const sorted = [...databases].sort((a, b) => (b.sizeOnDisk ?? 0) - (a.sizeOnDisk ?? 0));
  for (const db of sorted) {
    const mb = (db.sizeOnDisk ?? 0) / 1024 / 1024;
    totalMb += mb;
    const isSample = db.name.startsWith("sample_");
    if (isSample) sampleMb += mb;
    console.log(`  ${db.name.padEnd(26)} ${mb.toFixed(1).padStart(8)} MB${isSample ? "   ← sample data, safe to drop" : ""}`);
  }

  console.log(`\nusing ${totalMb.toFixed(1)} MB of ${M0_LIMIT_MB} MB`);
  if (sampleMb > 1) {
    console.log(
      `${sampleMb.toFixed(1)} MB of that is Atlas sample data you did not ask for.\n` +
        `Reclaim it with: npm run db:drop-samples --workspace @paizeis/api`,
    );
  }

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
