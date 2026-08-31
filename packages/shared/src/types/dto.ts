import type { BookingStatus, PitchType, Role } from "../constants";
import type { OpeningHours } from "../schemas/venue";

/**
 * The API contract. These are exactly what the server returns and exactly what
 * the web and mobile clients consume — ids are strings, dates are ISO 8601, and
 * no Mongo or Mongoose type ever leaks past this boundary.
 */

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  location: string | null;
  roles: Role[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: UserDto;
}

export interface PitchDto {
  id: string;
  name: string;
  pitchType: PitchType;
  pricePerHour: number;
  features: string[];
  isAvailable: boolean;
}

export interface VenueDto {
  id: string;
  name: string;
  city: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  imageUrl: string | null;
  futsalImageUrl: string | null;
  paddleImageUrl: string | null;
  googleRating: number | null;
  googleReviewsCount: number | null;
  bookingMethod: string | null;
  openingHours: OpeningHours;
  depositRate: number;
  pitches: PitchDto[];
  /** Present only when the request supplied `near`. */
  distanceKm?: number;
}

export interface SlotDto {
  /** ISO 8601 UTC. Clients render it in the venue's timezone. */
  startsAt: string;
  endsAt: string;
  available: boolean;
  /** Why the slot is unavailable — for UI copy, never for authorization. */
  reason?: "booked" | "blocked" | "past" | "closed";
  pricePerSlot: number;
}

export interface AvailabilityDto {
  venueId: string;
  date: string;
  durationHours: number;
  timezone: string;
  pitches: Array<{ pitch: PitchDto; slots: SlotDto[] }>;
}

export interface BookingDto {
  id: string;
  venueId: string;
  venueName: string;
  pitchId: string;
  pitchName: string;
  pitchType: PitchType;
  teamId: string;
  teamName: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  durationHours: number;
  totalAmount: number;
  depositAmount: number;
  currency: string;
  status: BookingStatus;
  players: string[];
  /** Set while status is `held`; the slot frees itself at this moment. */
  holdExpiresAt: string | null;
  createdAt: string;
}

export interface CheckoutSessionDto {
  bookingId: string;
  /** Open in an in-app browser on mobile, redirect on web. */
  checkoutUrl: string;
  expiresAt: string;
}

export interface RosterMemberDto {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  position: string | null;
  isCaptain: boolean;
  joinedAt: string;
}

export interface TeamDto {
  id: string;
  name: string;
  captainId: string;
  memberCount: number;
  roster: RosterMemberDto[];
  createdAt: string;
}

export interface PlayerStatsDto {
  userId: string;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  cleanSheets: number;
  totalMatches: number;
}

export interface PitchBlockDto {
  id: string;
  pitchId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdAt: string;
}

export interface InvitationDto {
  id: string;
  email: string;
  type: "team" | "booking" | "tournament";
  teamId: string | null;
  bookingId: string | null;
  tournamentId: string | null;
  invitedBy: string;
  expiresAt: string;
}
