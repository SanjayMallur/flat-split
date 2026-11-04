import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { vignetteColors } from './media';
import { useSlideIn } from './motion';

/**
 * FROZEN. Everything `MapSurface` needs that is NOT the native map module.
 *
 * THE SPLIT IS LOAD-BEARING AND WAS PROVEN BY A FAILED BUILD, not assumed. The first version
 * of this component used the recipe 32 Rork apps use — `if (Platform.OS !== 'web') { const m =
 * require('react-native-maps') }` — and `expo export --platform web` still failed:
 *
 *     Importing native-only module "react-native/Libraries/Utilities/codegenNativeCommands"
 *     on web from: node_modules/react-native-maps/lib/MapMarkerNativeComponent.js
 *
 * Metro resolves `require` by STATIC ANALYSIS; the `Platform.OS` guard runs at runtime and is
 * invisible to it, so the native module lands in the web bundle regardless. The only mechanism
 * that keeps a module out of a platform's graph is the platform file extension: Metro resolves
 * `MapSurface.web.tsx` for web and never reads `MapSurface.tsx`, so the import in that file
 * can be — and is — an ordinary top-level one.
 *
 * That matters more here than in a typical app: this file is FROZEN, and a red-screening web
 * preview is the surface a customer judges first.
 */

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  /** Shown in the web fallback list, and as the marker's accessibility label. */
  label?: string;
};

// The two halves declare their props INLINE rather than sharing a type alias. The prompt
// reference the screen-writer reads is the component's own signature — an alias shows it
// `({...}: MapSurfaceProps)` and no prop names at all, which is a component it cannot call.
// `test_kit_map_surface.py` pins the two prop lists to each other so they cannot drift.

export const DEFAULT_WEB_HINT = 'Open on iOS or Android to see the live map.';

/** Fits every point with a margin; `fallbackCenter` is where an EMPTY set opens.
 *
 * An empty set is the normal state of a location PICKER, not an edge case, and the old
 * hardcoded `(20, 0)` put it in the middle of the Atlantic — a featureless grey rectangle the
 * owner reasonably read as a broken map when he opened "New Place" on his S23. A picker knows
 * better than this function does: it has the device's location. So it passes one.
 */
export function regionFor(
  points: MapPoint[],
  fallbackCenter?: { latitude: number; longitude: number },
) {
  if (points.length === 0) {
    return fallbackCenter
      ? { ...fallbackCenter, latitudeDelta: 0.08, longitudeDelta: 0.08 }
      // Still a world view with no better information, but centred on land rather than open
      // ocean so it reads as "zoomed out", not "failed to load".
      : { latitude: 20, longitude: 20, latitudeDelta: 90, longitudeDelta: 90 };
  }
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // A floor, because a single point (or several in one city) yields a delta of 0, which
    // react-native-maps reads as "zoom to the maximum" and lands on a grey tile.
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.05),
  };
}

/**
 * Google's own style JSON, cut down to the two things that matter: take the map's geometry
 * and water toward the app's surface colours, and silence the label clutter that makes every
 * generated map look identical. Everything else is left to Google, because a fully restyled
 * map stops being legible as a map.
 */
export function mapStyleFor(t: Theme) {
  const dark = t.mode === 'dark';
  return [
    { elementType: 'geometry', stylers: [{ color: t.palette.surfaceAlt }] },
    { elementType: 'labels.text.fill', stylers: [{ color: t.palette.textMuted }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: t.palette.bg }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: dark ? 'off' : 'simplified' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: t.palette.bg }] },
  ];
}

/**
 * The vignettes and the floating slot — identical on both platforms, so neither copy owns it.
 *
 * `selected` is held MOUNTED through the exit animation and hidden with `pointerEvents`
 * instead of being unmounted: a hook cannot animate out a child React has already removed.
 * That is why the card is rendered here rather than conditionally by the screen.
 */
export function MapFloatingLayer({
  selected,
  vignettes = true,
}: {
  selected?: React.ReactNode;
  /**
   * OFF on web, and that is not a detail. A vignette exists to keep floating UI legible over
   * map tiles this app does not control. The web half has no tiles — it renders its own list
   * on its own surface — so the same gradient just fogs the app's own text, which is what it
   * did to the fallback's "open on iOS or Android" line until this was rendered and looked at.
   */
  vignettes?: boolean;
}) {
  const t = useTheme();
  const slide = useSlideIn(Boolean(selected));
  return (
    <>
      {vignettes ? (
        <>
          <LinearGradient colors={vignetteColors(t, 'top')} style={styles.topVignette} pointerEvents="none" />
          <LinearGradient
            colors={vignetteColors(t, 'bottom')}
            style={styles.bottomVignette}
            pointerEvents="none"
          />
        </>
      ) : null}
      <Animated.View
        style={[styles.floating, slide.style, { left: t.spacing.lg, right: t.spacing.lg }]}
        pointerEvents={selected ? 'auto' : 'none'}
      >
        {selected}
      </Animated.View>
    </>
  );
}

export const styles = StyleSheet.create({
  fill: { flex: 1, position: 'relative', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  topVignette: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  bottomVignette: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 },
  floating: { position: 'absolute', bottom: 24 },
  webRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
});
