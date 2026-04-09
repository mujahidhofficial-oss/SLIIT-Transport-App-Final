import { BrandColors } from "@/app/_theme/colors";

/**
 * Design tokens — tweak to match Figma Dev Mode (spacing / colors / radii).
 * Figma reference: https://www.figma.com/design/2rDbMu1nubuTJjRXIhUYHF/Transport-app--Community-
 */
export const Radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const Space = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const Layout = {
  screenPaddingX: 20,
  contentMaxWidth: 560,
} as const;

export const Elevated = {
  card: {
    shadowColor: BrandColors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  soft: {
    shadowColor: BrandColors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
} as const;

export const ScreenBg = {
  /** Light screens (lists, forms) */
  light: "#F0F5FA",
  /** Dark hero band */
  heroTop: "#085E9B",
  heroBottom: "#0E2A47",
} as const;

/** Shared type scale for native-feeling screens (iOS/Android). */
export const Typography = {
  largeTitle: { fontSize: 28, fontWeight: "900" as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  subhead: { fontSize: 13, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "600" as const },
  overline: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
} as const;
