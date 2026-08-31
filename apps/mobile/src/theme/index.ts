/**
 * The web app's design tokens, ported from its CSS custom properties.
 *
 * Its identity is black backgrounds, a mono typeface and one olive-green
 * accent — carried over exactly so the app is recognisably the same product.
 * The HSL values are converted to hex here because React Native has no CSS
 * variables to resolve.
 */
export const colors = {
  /** hsl(0 0% 0%) — the app is dark throughout, as the site is. */
  background: "#000000",
  surface: "#0D0D0D",
  surfaceRaised: "#161616",

  /** hsl(81 54% 31%) — the olive green used for every primary action. */
  primary: "#637A24",
  primaryPressed: "#516320",
  primaryForeground: "#FFFFFF",

  /** hsl(38 92% 50%) — amber, for streaks and highlights. */
  accent: "#F5A20A",

  success: "#637A24",
  danger: "#DC2626",

  text: "#FAFAFA",
  textMuted: "rgba(250,250,250,0.62)",
  textFaint: "rgba(250,250,250,0.38)",

  border: "rgba(255,255,255,0.15)",
  borderStrong: "rgba(255,255,255,0.28)",

  overlay: "rgba(0,0,0,0.60)",
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
} as const;

export const radius = {
  sm: 6, md: 10, lg: 16, pill: 999,
} as const;

/**
 * The site leans on a monospace face for headings and labels. These are the
 * system monospace stacks — no font file to download, and no licence to chase.
 */
export const fonts = {
  mono: process.env.EXPO_OS === "ios" ? "Menlo" : "monospace",
  body: process.env.EXPO_OS === "ios" ? "System" : "sans-serif",
} as const;

export const type = {
  display: { fontSize: 28, fontWeight: "700" as const, letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: "700" as const },
  heading: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 1.2 },
  caption: { fontSize: 12, fontWeight: "400" as const },
} as const;
