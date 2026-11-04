import type { Theme } from '@/theme/tokens';

/**
 * FROZEN. The scrim ramp that makes text legible over a photograph, derived from the theme
 * rather than hardcoded.
 *
 * WHY A THREE-STOP RAMP AND NOT TWO. A two-stop `['transparent', 'rgba(0,0,0,0.55)']` — what
 * a generated screen wrote by hand on the Wander build — puts the whole density change in the
 * middle of the image, so the photograph visibly dims where nothing is written. Three stops
 * hold the top clear, start the fall late, and land dark only under the text. It is the ramp
 * the corpus uses (RESEARCH-beautiful-mobile-frontends §9.25): `transparent` → 0.2 → 0.95.
 *
 * 0.95 AT THE FOOT, not 0.55. Round 2 of the mockup loop set a 0.55 minimum for white text on
 * a MID-TONE photo and the very next draw put a name over a bright one, unreadable. The photos
 * that break overlay text are the bright ones, and a scrim that is only dark enough for the
 * average photo is not dark enough for the one that matters.
 *
 * DERIVED FROM `palette.bg`, so on a dark theme the scrim is the app's own near-black and on a
 * light theme it is that theme's ink. A fixed black scrim on a cream app reads as a hole cut
 * in the page.
 */

/** `#rgb` / `#rrggbb` / `#rrggbbaa` / `rgb()` / `rgba()` → `rgba(r, g, b, alpha)`. */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = color.trim();

  if (hex.startsWith('#')) {
    const body = hex.slice(1);
    const full =
      body.length === 3 || body.length === 4
        ? body
            .slice(0, 3)
            .split('')
            .map((c) => c + c)
            .join('')
        : body.slice(0, 6);
    const n = parseInt(full, 16);
    if (full.length === 6 && !Number.isNaN(n)) {
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
  }

  const m = hex.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) {
    return `rgba(${Math.round(+m[1])}, ${Math.round(+m[2])}, ${Math.round(+m[3])}, ${a})`;
  }

  // An unparseable colour must not silently become a transparent scrim — that is the
  // unreadable-text defect with no symptom at the point of failure. Black is the safe wrong
  // answer: legible everywhere, only ever the wrong HUE.
  return `rgba(0, 0, 0, ${a})`;
}

/**
 * WHERE the three stops land, as fractions of the media's height.
 *
 * Without this the ramp is spread over the WHOLE image, so at the title's own y — roughly the
 * bottom fifth of the card — the ink is only about half-applied, and a bright photo shows
 * straight through the subtitle. Seen by rendering the component, not by reading it: the ramp
 * and its alphas were copied correctly from the corpus and still produced weak text, because
 * the corpus cards are 240px tall and ours default to 220 with two lines in them.
 *
 * Ending at 0.85 rather than 1 is the point: `LinearGradient` holds the final colour past the
 * last stop, so the bottom 15% — where the text actually sits — is fully inked rather than
 * still ramping toward it.
 */
export const SCRIM_LOCATIONS = [0, 0.45, 0.85] as const;

/**
 * Bottom-anchored scrim for WHITE text over media. BLACK, on every theme.
 *
 * It used to fade to the page colour (`palette.bg`) at 95%, so the photo melted into the
 * screen below it. On a DARK theme that is a dark fade and white text reads. On a LIGHT
 * theme the page is near-white, so the photo faded to near-white UNDER WHITE TEXT: measured
 * at 1.1:1 contrast on a generated app's Account hero and sign-in card (2026-09-18), where
 * the floor is 3:1 for a title and 4.5:1 for the line under it. It was tuned on Wander, the
 * first dark app, and never checked on a light one.
 *
 * Owner decision D1 (2026-09-18): a dark fade under white text on every theme — the
 * photo-overlay convention, and the only one where legibility does not depend on how bright
 * the photo happens to be. It is also what the approved MOCKUP already draws
 * (`mockup_icons.SCRIM_GRADIENT`, black to 0.72), so the app now matches the picture the user
 * signed off, and the fidelity judge compares like with like.
 *
 * 0.72, not the old 0.95: at 0.95 on black the bottom of every photo becomes a solid bar, and
 * 0.72 is the value the mockup chose because bright photos are the ones that break 0.55.
 * Typed as a 3-tuple because `LinearGradient`'s `colors` prop needs at least two entries.
 * `test_white_on_media_matches_the_mockup` fails if this and the mockup drift apart.
 */
export const SCRIM_COLORS = ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.72)'] as const;

/**
 * What a white glyph or label floating ON a photo sits on: the back button, the chip.
 *
 * Same decision as `SCRIM_COLORS`, for the same measured reason — these were
 * `palette.bg` at 45%, which is a cream pill under white text on a light theme. Black at 45%
 * is exactly the pill the mockup draws (`mockup_icons`, `rgba(0,0,0,0.45)`).
 */
export const MEDIA_CONTROL_BACKING = 'rgba(0, 0, 0, 0.45)';

/**
 * Edge vignette for UI floating over content the app does not control — a map, chiefly.
 * `from` is the edge the UI sits against, so the opaque stop is first at the top and last at
 * the bottom.
 */
export function vignetteColors(t: Theme, from: 'top' | 'bottom'): readonly [string, string, string] {
  const ink = t.palette.bg;
  const ramp = [withAlpha(ink, 0.92), withAlpha(ink, 0.6), withAlpha(ink, 0)] as const;
  return from === 'top' ? ramp : ([ramp[2], ramp[1], ramp[0]] as const);
}
