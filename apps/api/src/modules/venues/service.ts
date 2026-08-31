import type { PipelineStage } from "mongoose";
import type { VenueDto, VenueQuery } from "@paizeis/shared";
import { PITCH_TYPES_BY_CATEGORY } from "@paizeis/shared";
import { ApiError } from "../../lib/errors.js";
import { toObjectId } from "../../lib/tokens.js";
import { VenueModel } from "../../models/index.js";
import { toVenueDto } from "./mapper.js";

/**
 * Strips pitches that are not bookable.
 *
 * Applied on every player-facing read, so a hidden pitch type disappears from
 * listings, detail pages and pitch-type badges alike rather than only from the
 * one place it was remembered.
 */
function bookable(venue: Record<string, any>): Record<string, any> {
  return { ...venue, pitches: (venue.pitches ?? []).filter((p: Record<string, any>) => p.isAvailable !== false) };
}

/**
 * Venue search — the query behind the Venues screen: search box, city chips,
 * sport and pitch-type filters, and "closest to me".
 *
 * Public: the old app let signed-out visitors browse venues, and there is no
 * reason for that to need an account.
 */
export async function listVenues(query: VenueQuery): Promise<VenueDto[]> {
  /**
   * A venue with nothing bookable is not a venue as far as a player is
   * concerned, so it never reaches the list. This is what makes hiding a whole
   * pitch type work: hide every padel court and the padel-only venues leave
   * the app on their own, without deleting a single record.
   */
  const match: Record<string, unknown> = {
    pitches: { $elemMatch: { isAvailable: true } },
  };

  if (query.city) match.city = query.city;

  if (query.pitchType) {
    match["pitches.pitchType"] = query.pitchType;
  } else if (query.sport) {
    match["pitches.pitchType"] = { $in: [...PITCH_TYPES_BY_CATEGORY[query.sport]] };
  }

  if (query.q) {
    // Regex rather than the text index: users type partial words ("stro" for
    // Strovolos), and a text index only matches whole terms.
    const term = escapeRegex(query.q);
    match.$or = [
      { name: { $regex: term, $options: "i" } },
      { location: { $regex: term, $options: "i" } },
      { city: { $regex: term, $options: "i" } },
    ];
  }

  // Near-me: $geoNear must be the first stage of the pipeline, and it sorts by
  // distance itself, so the filters ride along inside it.
  if (query.near) {
    const [lat, lng] = query.near.split(",").map(Number);
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng!, lat!] },
          distanceField: "distanceMeters",
          maxDistance: query.radiusKm * 1000,
          spherical: true,
          query: match,
        },
      },
    ];
    const venues = await VenueModel.aggregate(pipeline);
    return venues.map((venue) => toVenueDto(bookable(venue)));
  }

  const venues = await VenueModel.find(match).sort({ name: 1 }).lean();
  return venues.map((venue) => toVenueDto(bookable(venue)));
}

export async function getVenue(id: string): Promise<VenueDto> {
  const venue = await VenueModel.findById(toObjectId(id)).lean();
  if (!venue) throw ApiError.notFound("Venue not found");

  return toVenueDto(bookable(venue));
}

/** Cities that actually have venues, for the filter chips. */
export async function listCities(): Promise<Array<{ city: string; venueCount: number }>> {
  const rows = await VenueModel.aggregate<{ _id: string; count: number }>([
    // Same rule as the list: a city whose venues are all unbookable should not
    // appear as a filter that returns nothing.
    { $match: { pitches: { $elemMatch: { isAvailable: true } } } },
    { $group: { _id: "$city", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({ city: row._id, venueCount: row.count }));
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
