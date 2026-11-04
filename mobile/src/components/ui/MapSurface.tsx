import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '@/theme/ThemeProvider';
import {
  DEFAULT_WEB_HINT,
  MapFloatingLayer,
  mapStyleFor,
  regionFor,
  styles,
  type MapPoint,
} from './mapSurface.shared';

export type { MapPoint };

/**
 * FROZEN. A real map, themed, with a floating card for the selected point. NATIVE half.
 *
 * `react-native-maps` is imported at the TOP LEVEL here and that is safe precisely because
 * this file never enters the web bundle — Metro resolves `MapSurface.web.tsx` for web. See
 * `mapSurface.shared.tsx` for why the runtime `Platform.OS` guard that 32 Rork apps use is
 * NOT sufficient (it fails `expo export --platform web`, measured).
 *
 * WHY THIS COMPONENT EXISTS. `react-native-maps@1.20.1` has been in the frozen catalogue since
 * the dependency survey and appeared in NOT ONE generated app. With no kit component for a
 * map, the screen-writer builds what the mockup shows — and the mockup drew a schematic, so
 * the Wander build shipped a flat scatter of dots in a bordered box with two paragraphs
 * apologising for it.
 *
 * The treatment is measured, not invented (RESEARCH-beautiful-mobile-frontends §9.25): the map
 * is the whole surface rather than a bordered box; `customMapStyle` paints it in the app's own
 * palette, which is what stops it reading as Google Maps with our UI on top; points of
 * interest, buildings and traffic are OFF, because that furniture belongs to Google's product;
 * two `pointerEvents="none"` vignettes keep anything floating legible over any tile; the
 * marker grows when it is selected; and tapping the map clears the selection.
 */
export function MapSurface({
  points,
  selectedId,
  onSelect,
  onDeselect,
  selected,
  initialCenter,
}: {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (point: MapPoint) => void;
  onDeselect?: () => void;
  /** Rendered in the floating slot. Use `<SelectedCard>`; it animates in and out here. */
  selected?: React.ReactNode;
  /** Shown above the fallback list on web, where there is no native map. */
  webHint?: string;
  /** Where to open when `points` is empty — a picker should pass the device's location. */
  initialCenter?: { latitude: number; longitude: number };
}) {
  const t = useTheme();

  return (
    <View style={styles.fill}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(points, initialCenter)}
        customMapStyle={mapStyleFor(t)}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={() => onDeselect?.()}
      >
        {points.map((p) => {
          const isSelected = p.id === selectedId;
          return (
            // THE LIBRARY'S OWN MARKER, NOT A CUSTOM CHILD VIEW. A `<Marker>` wrapping our
            // themed glyph is the obvious thing to write and it renders NOTHING on Android:
            // react-native-maps rasterises a custom child to a bitmap once, and an icon-font
            // glyph has not painted at that moment, so the map draws blank images at the right
            // coordinates. The owner's S23 showed real tiles, our `customMapStyle`, and not one
            // pin for three places the header was counting.
            //
            // The first fix was `tracksViewChanges` starting true and settling to false — the
            // documented remedy. It was verified present in the bundle his phone reloaded and
            // the pins still did not appear. So the child view goes: `pinColor` tints the
            // platform's own marker, which has no snapshot step to lose and cannot be blank.
            // A themed glyph is worth having and is worth nothing at all if it does not draw.
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              onPress={() => onSelect?.(p)}
              pinColor={isSelected ? t.palette.primary : t.palette.textMuted}
              accessibilityLabel={p.label}
            />
          );
        })}
      </MapView>
      <MapFloatingLayer selected={selected} />
    </View>
  );
}

export { DEFAULT_WEB_HINT };
