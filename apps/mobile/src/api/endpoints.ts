import type {
  AuthResponse, AvailabilityDto, BookingDto, CheckoutSessionDto,
  PlayerStatsDto, SignInInput, SignUpInput, TeamDto, UserDto, VenueDto,
} from "@paizeis/shared";
import { apiRequest } from "./client";

/** Every call the app can make, in one place, typed by the shared contract. */

export const auth = {
  register: (input: SignUpInput) =>
    apiRequest<AuthResponse>("/auth/register", { method: "POST", body: input, authenticated: false }),
  signIn: (input: SignInInput) =>
    apiRequest<AuthResponse>("/auth/login", { method: "POST", body: input, authenticated: false }),
  refresh: (refreshToken: string) =>
    apiRequest<AuthResponse>("/auth/refresh", { method: "POST", body: { refreshToken }, authenticated: false }),
  signOut: (refreshToken: string) =>
    apiRequest<void>("/auth/logout", { method: "POST", body: { refreshToken }, authenticated: false }),
};

export const me = {
  get: () => apiRequest<UserDto>("/me"),
  update: (input: Partial<{ fullName: string; phone: string; location: string }>) =>
    apiRequest<UserDto>("/me", { method: "PATCH", body: input }),
  bookings: () => apiRequest<BookingDto[]>("/me/bookings"),
  stats: () => apiRequest<PlayerStatsDto>("/me/stats"),
  deleteAccount: () => apiRequest<void>("/me", { method: "DELETE", body: { confirm: "DELETE" } }),
  registerDevice: (expoPushToken: string, platform: "ios" | "android" | "web") =>
    apiRequest<void>("/me/devices", { method: "POST", body: { expoPushToken, platform } }),
};

export const venues = {
  list: (query: { q?: string; city?: string; sport?: string; pitchType?: string; near?: string; radiusKm?: number }) =>
    apiRequest<VenueDto[]>("/venues", { query, authenticated: false }),
  cities: () => apiRequest<Array<{ city: string; venueCount: number }>>("/venues/cities", { authenticated: false }),
  get: (id: string) => apiRequest<VenueDto>(`/venues/${id}`, { authenticated: false }),
  availability: (id: string, query: { date: string; duration: number; pitchType?: string }) =>
    apiRequest<AvailabilityDto>(`/venues/${id}/availability`, { query, authenticated: false }),
};

export const bookings = {
  create: (input: { pitchId: string; teamId: string; startsAt: string; duration: number; players?: string[] }) =>
    apiRequest<BookingDto>("/bookings", { method: "POST", body: input }),
  get: (id: string) => apiRequest<BookingDto>(`/bookings/${id}`),
  cancel: (id: string, reason?: string) =>
    apiRequest<BookingDto>(`/bookings/${id}/cancel`, { method: "POST", body: { reason } }),
  checkout: (id: string) => apiRequest<CheckoutSessionDto>(`/bookings/${id}/checkout`, { method: "POST" }),
};

export interface MatchInvitation {
  id: string;
  bookingId: string;
  venueName: string;
  pitchName: string;
  startsAt: string;
  invitedByName: string;
  email: string;
  status: "pending" | "accepted" | "declined";
  expiresAt: string;
}

export const invitations = {
  mine: () => apiRequest<MatchInvitation[]>("/invitations"),
  invite: (bookingId: string, email: string) =>
    apiRequest<MatchInvitation>(`/bookings/${bookingId}/invitations`, { method: "POST", body: { email } }),
  accept: (id: string) => apiRequest<{ status: string }>(`/invitations/${id}/accept`, { method: "POST" }),
  decline: (id: string) => apiRequest<{ status: string }>(`/invitations/${id}/decline`, { method: "POST" }),
};

export interface TeamMessage {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export const teams = {
  list: () => apiRequest<TeamDto[]>("/teams"),
  create: (name: string) => apiRequest<TeamDto>("/teams", { method: "POST", body: { name } }),
  get: (id: string) => apiRequest<TeamDto>(`/teams/${id}`),
  rename: (id: string, name: string) => apiRequest<TeamDto>(`/teams/${id}`, { method: "PATCH", body: { name } }),
  addMember: (id: string, email: string) =>
    apiRequest<TeamDto>(`/teams/${id}/members`, { method: "POST", body: { email } }),
  removeMember: (id: string, userId: string) =>
    apiRequest<TeamDto>(`/teams/${id}/members/${userId}`, { method: "DELETE" }),
  leave: (id: string) =>
    apiRequest<{ left: true; teamDeleted: boolean }>(`/teams/${id}/leave`, { method: "POST" }),
  messages: (id: string) => apiRequest<TeamMessage[]>(`/teams/${id}/messages`),
  send: (id: string, body: string) =>
    apiRequest<TeamMessage>(`/teams/${id}/messages`, { method: "POST", body: { body } }),
};
