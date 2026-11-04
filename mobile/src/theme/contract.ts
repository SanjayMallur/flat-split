/**
 * FROZEN. The shape every generated theme must satisfy.
 *
 * `Theme` used to be `typeof theme` — derived from whatever `tokens.ts` happened to
 * contain. That meant a theme with a different key set failed `tsc` inside an unrelated
 * frozen component, pointing at the callsite instead of the cause. Declaring the contract
 * here makes `theme.generated.ts` fail at its own definition (T8).
 *
 * It lives in its own file rather than in `tokens.ts` so `theme.generated.ts` can import
 * the types without an import cycle: `tokens.ts` imports values FROM the generated file.
 */

export type ThemeMode = 'light' | 'dark';

/**
 * The glyph family this app renders.
 *
 * `material` is `@expo/vector-icons`' MaterialIcons, which is NOT Google Material Symbols —
 * they share a name and a heritage but not a glyph set, so a design drawn against Symbols
 * will ask for names MaterialIcons does not have. `material-community` is the widest.
 */
export type IconSet = 'ionicons' | 'material' | 'material-community' | 'feather';

export interface Palette {
  white: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  /** The scrim behind a modal — the one palette colour that is translucent. */
  overlay: string;
  text: string;
  textMuted: string;
  /** Ink for text sitting on a filled accent control. */
  textInverse: string;
  primary: string;
  primaryPressed: string;
  primaryText: string;
  danger: string;
  dangerText: string;
  success: string;
  warning: string;
}

export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface Radius {
  sm: number;
  md: number;
  lg: number;
  /** Pill sentinel, not a measurement — never scaled by density. */
  full: number;
}

export interface TypeVariant {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  /**
   * Absent means the platform system font. The template ships Inter on every variant, so
   * absence now only happens for a theme that names no family at all. A named family must
   * be loaded (expo-font) before it renders; an unloaded name falls back to the system font
   * rather than failing.
   */
  fontFamily?: string;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase';
}

export interface Typography {
  h1: TypeVariant;
  h2: TypeVariant;
  h3: TypeVariant;
  body: TypeVariant;
  label: TypeVariant;
  caption: TypeVariant;
}

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface Shadow {
  card: ShadowStyle;
  raised: ShadowStyle;
}

export interface Theme {
  mode: ThemeMode;
  iconSet: IconSet;
  palette: Palette;
  spacing: Spacing;
  radius: Radius;
  typography: Typography;
  shadow: Shadow;
}
