/**
 * Hides or restores every pitch of a given type.
 *
 *   npm run pitches:hide -- padel     take padel off the app
 *   npm run pitches:show -- padel     put it back
 *
 * Hiding sets `isAvailable: false` rather than deleting anything: 30 of the 52
 * venues are padel-only, and they carry geocoded coordinates, photos and phone
 * numbers that would be expensive to rebuild. A flag is reversible; a delete is
 * a re-import.
 */
import mongoose from "mongoose";
import { PITCH_TYPES, type PitchType } from "@paizeis/shared";
import { connectMongo, disconnectMongo } from "../db/mongo.js";
import { VenueModel } from "../models/index.js";

const [, , action, rawType] = process.argv;
const type = rawType as PitchType;

if (action !== "hide" && action !== "show") {
  console.error("Usage: setPitchVisibility.ts <hide|show> <pitchType>");
  process.exit(1);
}
if (!PITCH_TYPES.includes(type)) {
  console.error(`Unknown pitch type "${rawType}". Known types: ${PITCH_TYPES.join(", ")}`);
  process.exit(1);
}

async function main(): Promise<void> {
  await connectMongo();
  const isAvailable = action === "show";

  const result = await VenueModel.updateMany(
    { "pitches.pitchType": type },
    { $set: { "pitches.$[pitch].isAvailable": isAvailable } },
    { arrayFilters: [{ "pitch.pitchType": type }] },
  );

  const affected = await VenueModel.countDocuments({ "pitches.pitchType": type });
  const stranded = await VenueModel.countDocuments({
    "pitches.pitchType": type,
    pitches: { $not: { $elemMatch: { isAvailable: true } } },
  });

  console.log(`${action === "hide" ? "hid" : "restored"} every ${type} pitch`);
  console.log(`  venues touched        ${result.modifiedCount} of ${affected}`);
  console.log(
    action === "hide"
      ? `  venues now unbookable ${stranded} (they drop out of the venues list)`
      : `  venues still unbookable ${stranded}`,
  );

  await disconnectMongo();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
