import type { PitchDto, PitchType, VenueDto } from "@paizeis/shared";
import { DEFAULT_DEPOSIT_RATE, DEFAULT_OPENING_HOURS } from "@paizeis/shared";

/** A venue as it comes back from a lean() query, plus an optional geoNear distance. */
type LeanVenue = Record<string, any> & { distanceMeters?: number };

export function toPitchDto(pitch: Record<string, any>): PitchDto {
  return {
    id: String(pitch._id),
    name: pitch.name,
    pitchType: pitch.pitchType as PitchType,
    pricePerHour: pitch.pricePerHour,
    features: pitch.features ?? [],
    isAvailable: pitch.isAvailable !== false,
  };
}

/**
 * The only place a venue document becomes a wire response. Coordinates are
 * unpacked back into latitude/longitude here — clients think in that order,
 * GeoJSON stores the reverse, and keeping the flip in one function is what
 * stops it being got wrong somewhere else.
 */
export function toVenueDto(venue: LeanVenue): VenueDto {
  const [longitude, latitude] = venue.geo?.coordinates ?? [];

  return {
    id: String(venue._id),
    name: venue.name,
    city: venue.city,
    location: venue.location,
    latitude: typeof latitude === "number" ? latitude : null,
    longitude: typeof longitude === "number" ? longitude : null,
    phone: venue.phone ?? null,
    website: venue.website ?? null,
    imageUrl: venue.imageUrl ?? null,
    futsalImageUrl: venue.futsalImageUrl ?? null,
    paddleImageUrl: venue.paddleImageUrl ?? null,
    googleRating: venue.googleRating ?? null,
    googleReviewsCount: venue.googleReviewsCount ?? null,
    bookingMethod: venue.bookingMethod ?? null,
    openingHours: venue.openingHours ?? { ...DEFAULT_OPENING_HOURS },
    depositRate: venue.depositRate ?? DEFAULT_DEPOSIT_RATE,
    pitches: (venue.pitches ?? []).map(toPitchDto),
    ...(typeof venue.distanceMeters === "number"
      ? { distanceKm: Math.round(venue.distanceMeters / 100) / 10 }
      : {}),
  };
}
