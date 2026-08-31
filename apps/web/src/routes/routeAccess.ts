/**
 * Single source of truth for route accessibility.
 *
 * - `public`: reachable without a session (marketing + auth entry points).
 * - `authenticated`: requires a signed-in user.
 * - `admin` / `venueManager`: requires a signed-in user with the given role,
 *   verified server-side through the database (user_roles / venue_managers).
 *
 * Server-side enforcement (RLS + edge function JWT checks) remains the real
 * security boundary; this map keeps the client from exposing surfaces that
 * would only produce failed, spam-prone requests.
 */
export type RouteAccess = "public" | "authenticated" | "admin" | "venueManager";

export const ROUTE_ACCESS: Record<string, RouteAccess> = {
  "/": "public",
  "/auth": "public",
  "/admin_signin": "public",
  "/super-admin-login": "public",

  "/venues": "public",
  "/booking/:venueId": "authenticated",
  "/demo-checkout": "authenticated",
  "/booking-success": "authenticated",
  "/stats": "authenticated",
  "/stats/:playerId": "authenticated",
  "/add-match-stats": "authenticated",
  "/rewards": "authenticated",
  "/tournaments": "authenticated",
  "/teams": "authenticated",
  "/team/:teamId": "authenticated",
  "/find-team": "authenticated",
  "/profile": "authenticated",
  "/crm": "authenticated",

  "/venue-admin": "venueManager",
  "/venue-manager-assignment": "admin",
  "/setup-test-managers": "admin",
  "/super-admin": "admin",
  "/super-admin-dashboard": "admin",
  "/admin/venues": "admin",
};
