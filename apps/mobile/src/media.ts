import Constants from "expo-constants";

/**
 * Where the site's images and videos come from.
 *
 * The web app imports these through Lovable `.asset.json` pointer files, which
 * a native binary has no way to resolve. They are served by the API during
 * development and will move to Cloudflare R2 for release — one base URL to
 * change, not twenty call sites.
 */
const apiUrl: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "http://localhost:4000/api/v1";

/** Strip the /api/v1 suffix: media is served from the server root. */
export const MEDIA_ORIGIN = apiUrl.replace(/\/api\/v1\/?$/, "");

export const media = {
  /** Home hero — the portrait cut the site uses below the md breakpoint. */
  homeVideo: `${MEDIA_ORIGIN}/media/futsal_mobile.mp4`,
  /** Auth hero — again the site's mobile cut. */
  authVideo: `${MEDIA_ORIGIN}/media/futsal_auth_mobile.mp4`,
  /** Venues list background. */
  venuesVideo: `${MEDIA_ORIGIN}/media/futsal_18.mp4`,
  /** Booking flow — the pixel-art portrait background. */
  bookingBackground: `${MEDIA_ORIGIN}/media/booking_bg_mobile.jpg`,
  /** Pixel pitch, used behind teams and auth on the site. */
  pixelPitch: `${MEDIA_ORIGIN}/media/pixel_pitch_bg.jpg`,

  /**
   * The wordmark with its black field removed and cropped to the lettering.
   * The original is a 1024² JPEG that is mostly empty black, so it both
   * carried a visible box over video and rendered tiny inside any sensible box.
   */
  navLogo: `${MEDIA_ORIGIN}/media/paizeis_wordmark.png`,
  menuIcon: `${MEDIA_ORIGIN}/media/menu_play.png`,
  /**
   * The round badge that is the home screen's only call to action.
   *
   * Rebuilt from paizeis_futsal.jpg, whose lettering sits 125px below centre —
   * fine in the square the website uses, visibly low once cropped to a circle.
   */
  roundLogo: `${MEDIA_ORIGIN}/media/paizeis_badge.png`,
};

/**
 * Venue photos. Roughly half the venues store an absolute URL, the rest a
 * repo-relative path like /images/venues/city-fields.jpg.
 */
export function venueImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${MEDIA_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}
