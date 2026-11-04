/**
 * Tally style pack. Started from services/worker/theming.py's render of the pack palette, then
 * hand-tuned: the faces are the pack's own (Young Serif, Lato, DM Mono) and state weight 400 because the face IS the weight; every figure and label is the mono, through the label slot, so it loads.
 */
import type { Palette, Spacing, Radius, Typography, Shadow, ThemeMode } from './contract';

export const themeName: string = "Tally";
export const mode: ThemeMode = "dark";
export const iconSet = "feather" as const;

export const palette: Palette = {
  white: "#ffffff",
  bg: "#0e211b",
  surface: "#16302a",
  surfaceAlt: "#204036",
  border: "#2c4c42",
  overlay: "rgba(0, 0, 0, 0.6)",
  text: "#f3ecd9",
  textMuted: "#98ada3",
  textInverse: "#10211b",
  primary: "#e3bd63",
  primaryPressed: "#c9a44e",
  primaryText: "#10211b",
  danger: "#ff8a70",
  dangerText: "#10211b",
  success: "#8fd6a8",
  warning: "#e3bd63",
} as const;

export const spacing: Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius: Radius = {
  sm: 4,
  md: 8,
  lg: 14,
  full: 999,
} as const;

export const typography: Typography = {
  h1: { fontSize: 36, fontWeight: "400" as const, lineHeight: 40, fontFamily: "YoungSerif_400Regular" },
  h2: { fontSize: 22, fontWeight: "400" as const, lineHeight: 26, fontFamily: "YoungSerif_400Regular" },
  h3: { fontSize: 15, fontWeight: "400" as const, lineHeight: 20, fontFamily: "Lato_700Bold" },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22, fontFamily: "Lato_400Regular" },
  label: { fontSize: 11, fontWeight: "400" as const, lineHeight: 14, fontFamily: "DMMono_500Medium", letterSpacing: 0.6, textTransform: "uppercase" as const },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18, fontFamily: "Lato_400Regular" },
} as const;

export const shadow: Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 2,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;
