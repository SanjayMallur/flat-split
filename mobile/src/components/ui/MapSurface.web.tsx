import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { KitIcon } from './Icon';
import {
  DEFAULT_WEB_HINT,
  MapFloatingLayer,
  styles,
  type MapPoint,
} from './mapSurface.shared';

export type { MapPoint };

/**
 * FROZEN. `MapSurface`, WEB half. Metro resolves this file for web and never reads
 * `MapSurface.tsx`, which is the only mechanism that keeps `react-native-maps` — a package
 * with no web implementation — out of the preview bundle. See `mapSurface.shared.tsx`.
 *
 * IT DEGRADES HONESTLY rather than pretending. The same points render as a list, with a line
 * saying where the live map is. Drawing a fake map here would be the exact defect the native
 * half exists to remove, one platform over: the Wander build's Map screen was a scatter of
 * dots that looked like a map and was not one, and the screen-writer built it because the
 * mockup showed it.
 *
 * The floating layer is the SAME component as native, so a selected point gets the same card
 * in the same place with the same entrance. The map is what differs; the UI over it does not.
 */
export function MapSurface({
  points,
  selectedId,
  onSelect,
  onDeselect,
  selected,
  webHint = DEFAULT_WEB_HINT,
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
    <View style={[styles.fill, { backgroundColor: t.palette.surfaceAlt }]}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm }}>
        <Text style={[t.typography.caption, { color: t.palette.textMuted }]}>{webHint}</Text>
        {points.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onSelect?.(p)}
            accessibilityRole="button"
            accessibilityLabel={p.label}
            style={[
              styles.webRow,
              {
                backgroundColor: t.palette.surface,
                borderColor: p.id === selectedId ? t.palette.primary : t.palette.border,
                borderRadius: t.radius.md,
                padding: t.spacing.md,
                gap: t.spacing.sm,
              },
            ]}
          >
            <KitIcon name="pin" size={18} color={t.palette.primary} />
            <Text numberOfLines={1} style={[t.typography.body, { color: t.palette.text, flex: 1 }]}>
              {p.label ?? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <MapFloatingLayer selected={selected} vignettes={false} />
    </View>
  );
}

export { DEFAULT_WEB_HINT };
