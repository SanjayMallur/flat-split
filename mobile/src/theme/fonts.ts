import { typography } from './theme.generated';
import { PACK_FACES } from './pack.fonts';

/**
 * FROZEN. The typefaces this app can render, and the ones this theme actually asks for.
 *
 * WHAT CHANGED, AND WHY THE RECORDED OBJECTIONS DO NOT APPLY ANY MORE. An earlier version of
 * this file carried a catalogue of remote `.ttf` URLs and loaded them at boot. It was cut for
 * three reasons, and bundling answers all three:
 *
 *   1. `useFonts` blocks the first frame with no timeout, so a blocked domain or a captive
 *      network left the app on a blank screen. A bundled asset has no domain to block.
 *   2. One face per family was registered while the tokens ask for weights 400/600/700, and
 *      React Native does not synthesise the missing ones reliably. Every weight the tokens
 *      can emit is now its OWN registered face — `Inter_700Bold`, not `Inter` asked for
 *      weight 700 — so nothing is synthesised. This is also why the six voices ship as static
 *      instances rather than one variable file each: `expo-font`'s `FontResource` carries no
 *      weight descriptor, so a variable file registers exactly ONE instance and the other two
 *      weights would have silently collapsed onto it while the mockup showed three.
 *   3. The URLs had no availability test. There are no URLs.
 *
 * WHY THE FULL MAP IS DECLARED BUT NOT ALL OF IT LOADED. `require()` on an asset registers it
 * with Metro; it does not download it. Only the faces handed to `useFonts` are fetched at
 * boot, so declaring all eighteen costs nothing at runtime and a themed app pays for the
 * three (or six) faces it actually names.
 *
 * The vocabulary is owned by services/worker/bundled_fonts.py. `test_bundled_fonts.py`
 * asserts these keys, the files in assets/fonts/, the mockup's webfont list and the schema
 * enum are all the same six families — two lists that can drift apart WAS the defect.
 */
export const BUNDLED_FACES: Record<string, number> = {
  Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
  Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
  WorkSans_400Regular: require('../../assets/fonts/WorkSans_400Regular.ttf'),
  WorkSans_600SemiBold: require('../../assets/fonts/WorkSans_600SemiBold.ttf'),
  WorkSans_700Bold: require('../../assets/fonts/WorkSans_700Bold.ttf'),
  Archivo_400Regular: require('../../assets/fonts/Archivo_400Regular.ttf'),
  Archivo_600SemiBold: require('../../assets/fonts/Archivo_600SemiBold.ttf'),
  Archivo_700Bold: require('../../assets/fonts/Archivo_700Bold.ttf'),
  PlayfairDisplay_400Regular: require('../../assets/fonts/PlayfairDisplay_400Regular.ttf'),
  PlayfairDisplay_600SemiBold: require('../../assets/fonts/PlayfairDisplay_600SemiBold.ttf'),
  PlayfairDisplay_700Bold: require('../../assets/fonts/PlayfairDisplay_700Bold.ttf'),
  SpaceGrotesk_400Regular: require('../../assets/fonts/SpaceGrotesk_400Regular.ttf'),
  SpaceGrotesk_600SemiBold: require('../../assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  SpaceGrotesk_700Bold: require('../../assets/fonts/SpaceGrotesk_700Bold.ttf'),
  Nunito_400Regular: require('../../assets/fonts/Nunito_400Regular.ttf'),
  Nunito_600SemiBold: require('../../assets/fonts/Nunito_600SemiBold.ttf'),
  Nunito_700Bold: require('../../assets/fonts/Nunito_700Bold.ttf'),
};

/**
 * Every face this app can load: the six bundled families plus its style pack's faces, if it was
 * built in one. `pack.fonts.ts` is written per project by services/worker/style_packs.py and is
 * an empty map otherwise, so an app without a pack loads exactly what it did before.
 */
const REGISTERED_FACES: Record<string, number> = { ...BUNDLED_FACES, ...PACK_FACES };

/** The face out of whatever `fontFamily` holds.
 *
 * The renderer already writes a bare registered name, because React Native's `fontFamily` is
 * a lookup against a REGISTERED family and not a CSS stack — a value like
 * `"Archivo", sans-serif` matches nothing and falls back to the system font with no error at
 * all. This still splits, so a hand-edited generated file cannot reintroduce that silence. */
export const primaryFamily = (stack?: string): string => {
  if (!stack) return '';
  const [first = ''] = stack.split(',');
  return first.trim().replace(/^["']|["']$/g, '');
};

/**
 * Only the faces THIS theme names, ready for `useFonts`.
 *
 * A face the theme names but we hold no file for is SKIPPED rather than passed through:
 * `useFonts` rejects on an undefined module, and a rejected load renders no text at all —
 * far worse than the system-font fallback a missing face otherwise means. The schema's closed
 * enum should make that unreachable; this is the belt to its braces, because the generated
 * file is on disk and can be hand-edited.
 */
export const activeTextFonts: Record<string, number> = Object.fromEntries(
  Object.values(typography)
    .map((variant) => primaryFamily(variant.fontFamily))
    .filter((face) => face.length > 0 && face in REGISTERED_FACES)
    .map((face) => [face, REGISTERED_FACES[face]]),
);

/**
 * True when the theme NAMES a non-system typeface.
 *
 * Named for what it measures. It is about what the theme ASKED FOR, not about runtime font
 * state. The text-scaling cap keys on it, because the cap protects a layout designed around a
 * condensed or display face and that design decision exists whether or not the face has
 * finished loading; calling it `usesCustomTypeface` made it sound like a runtime fact.
 */
export const themeNamesCustomTypeface = Object.values(typography).some(
  (variant) => primaryFamily(variant.fontFamily).length > 0,
);
