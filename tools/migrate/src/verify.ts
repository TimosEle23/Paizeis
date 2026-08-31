/**
 * Verifies a migration against its source export.
 *
 *   npm run verify --workspace @paizeis/migrate
 *
 * Counts alone are not proof — they would pass with every field null. This also
 * spot-checks the transformations that could silently corrupt data, and asserts
 * that the guarantees the new schema is supposed to add actually hold.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { resolve } from "node:path";
import { UserModel, VenueModel, BookingModel, TeamModel, VenueManagerModel } from "@paizeis/api/models";
import { VENUE_TIMEZONE } from "@paizeis/shared";
import { toZonedTime, format } from "date-fns-tz";
import { loadExport } from "./loadExport.js";
import type { Row } from "./transform.js";

let failures = 0;

function check(label: string, passed: boolean, detail = ""): void {
  console.log(`  ${passed ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

async function main(): Promise<void> {
  const data = loadExport(resolve(process.env.EXPORT_PATH ?? "data/export.json"));
  const rows = (t: string): Row[] => (Array.isArray(data[t]) ? (data[t] as Row[]) : []);

  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB_NAME ?? "paizeis" });
  console.log(`verifying ${mongoose.connection.name}\n`);

  console.log("row parity");
  check("users", (await UserModel.countDocuments()) === rows("users").length);
  check("venues", (await VenueModel.countDocuments()) === rows("venues").length);
  check("teams", (await TeamModel.countDocuments()) === rows("teams").length);
  check("venue managers", (await VenueManagerModel.countDocuments()) === rows("venue_managers").length);
  const sourceBookings = rows("bookings").filter((b) => b.status !== "blocked").length;
  check("bookings", (await BookingModel.countDocuments()) === sourceBookings);

  const embeddedPitches = await VenueModel.aggregate([
    { $project: { n: { $size: "$pitches" } } },
    { $group: { _id: null, total: { $sum: "$n" } } },
  ]);
  check("pitches (embedded)", (embeddedPitches[0]?.total ?? 0) === rows("pitches").length);

  console.log("\ncredentials");
  const sourceHashes = rows("users").filter((u) => typeof u.encrypted_password === "string" && u.encrypted_password.length > 0);
  const migratedHashes = await UserModel.countDocuments({ passwordHash: { $type: "string" } });
  check("password hashes carried over", migratedHashes === sourceHashes.length, `${migratedHashes}/${sourceHashes.length}`);

  const sample = sourceHashes[0];
  if (sample) {
    const migratedUser = await UserModel.findOne({ email: String(sample.email).toLowerCase() }).lean();
    check("a known hash is byte-identical", migratedUser?.passwordHash === sample.encrypted_password);
  } else {
    check("a known hash is byte-identical", false, "no hashed accounts in the export to compare");
  }

  const admins = await UserModel.countDocuments({ roles: "admin" });
  const sourceAdmins = rows("user_roles").filter((r) => r.role === "admin").length;
  check("admin role preserved", admins === sourceAdmins, `${admins} admin(s)`);

  console.log("\ntransformations");
  // Times: read the migrated instant back in Cyprus local time and compare with
  // the original wall clock. This is what a DST mistake would break.
  const anyBooking = await BookingModel.findOne({}).sort({ startsAt: 1 }).lean();
  if (anyBooking) {
    const local = format(toZonedTime(anyBooking.startsAt, VENUE_TIMEZONE), "yyyy-MM-dd HH:mm", { timeZone: VENUE_TIMEZONE });
    const source = rows("bookings").find((b) => `${b.booking_date} ${String(b.start_time).slice(0, 5)}` === local);
    check("booking times round-trip to the same Cyprus wall clock", Boolean(source), local);
  }

  const paddle = await VenueModel.countDocuments({ "pitches.pitchType": "paddle" as never });
  const padel = await VenueModel.countDocuments({ "pitches.pitchType": "padel" });
  check('"paddle" normalised to "padel"', paddle === 0 && padel > 0, `${padel} venue(s) with padel`);

  const withGeo = await VenueModel.countDocuments({ "geo.coordinates.0": { $exists: true } });
  check("venues have GeoJSON coordinates", withGeo === rows("venues").length, `${withGeo}/${rows("venues").length}`);

  // Longitude first. Cyprus sits around 33°E, 35°N — if these were swapped the
  // coordinates would land in Iraq, and near-me would quietly return nothing.
  const geoSample = await VenueModel.findOne({ "geo.coordinates.0": { $exists: true } }).lean();
  const [lng, lat] = geoSample?.geo?.coordinates ?? [];
  check("coordinates are [lng, lat], not swapped", lng! > 32 && lng! < 35 && lat! > 34 && lat! < 36, `[${lng}, ${lat}]`);

  console.log("\nguarantees the old schema did not have");
  const near = await VenueModel.find({
    "geo.coordinates": { $near: { $geometry: { type: "Point", coordinates: [33.3823, 35.1856] }, $maxDistance: 30_000 } },
  }).limit(3).lean();
  check("near-me geospatial query works", near.length > 0, `${near.length} venue(s) within 30km of Nicosia`);

  // The point of the whole rebuild: the storage layer refuses a second active
  // booking of the same pitch at the same instant.
  const existing = await BookingModel.findOne({ status: { $in: ["held", "confirmed"] } }).lean()
    ?? await BookingModel.findOne({}).lean();
  let rejected = false;
  if (existing) {
    try {
      await BookingModel.create({
        ...existing, _id: undefined, status: "confirmed", createdAt: undefined, updatedAt: undefined,
      });
    } catch (err) {
      rejected = (err as { code?: number }).code === 11000;
    }
    // Clean up if the guard did not hold and the duplicate was written.
    if (!rejected) await BookingModel.deleteMany({ _id: { $ne: existing._id }, pitchId: existing.pitchId, startsAt: existing.startsAt });
  }
  check("duplicate booking of the same pitch and time is rejected", rejected);

  console.log(failures === 0 ? "\n✓ migration verified\n" : `\n✗ ${failures} check(s) failed\n`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
