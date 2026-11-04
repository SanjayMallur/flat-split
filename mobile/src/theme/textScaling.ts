import { themeNamesCustomTypeface } from './fonts';

/**
 * FROZEN. How far OS accessibility text sizes may scale this app's type (DT15).
 *
 * React Native's `allowFontScaling` defaults to TRUE, which is right — a user who has asked
 * for larger text should get it. But the ceiling that is safe depends on the typeface:
 * SF Pro and Roboto are designed across that whole range, while a condensed or display face
 * is not. At 200% a condensed uppercase label overflows the tab bar and the date strip
 * rather than growing gracefully, so the app that finally has a typeface is the app that
 * finally needs a cap.
 *
 * Capping rather than DISABLING is deliberate: `allowFontScaling={false}` ignores the
 * setting outright, which fails the users the setting exists for. A multiplier still honours
 * the request, just not past the point the layout survives.
 */
export const MAX_FONT_SIZE_MULTIPLIER = themeNamesCustomTypeface ? 1.4 : 1.8;

/**
 * Spread onto any `<Text>` in a FIXED-HEIGHT container — a tab bar label, a header title, a
 * chip, a date strip. Body copy in a scrolling view should NOT use this: it can grow as far
 * as the user asked, and capping it there is taking away the setting for no reason.
 */
export const cappedTextScaling = {
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
} as const;
