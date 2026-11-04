import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Img } from './Img';
import { KitIcon } from './Icon';
import { MEDIA_CONTROL_BACKING, SCRIM_COLORS, SCRIM_LOCATIONS, vignetteColors } from './media';
import type { IconName } from './Icon';

/**
 * FROZEN. The full-bleed photo that opens a detail screen, with the title over it.
 *
 * `MediaCard`'s sibling and deliberately NOT a variant of it: a card is an item in a list and
 * is inset, rounded and bordered, while this runs edge-to-edge and UNDER the status bar. One
 * component doing both ends up with a `variant` prop that silently changes four other things.
 *
 * PAIRS WITH `<Screen header={false}>`, which is the only way the photo reaches the top edge.
 * Under the default `Screen` the app bar sits above this and the effect is lost — you get a
 * grey bar, then a photo, which is the layout this replaces. It consumes `insets.top` itself
 * so its own back control and title clear the notch; that is why `Screen` can stop padding.
 *
 * `onBack` draws a back control on the photo. It is drawn here rather than left to the
 * platform header because a bare native header over a full-bleed image is an opaque bar
 * across the top of it — and NATIVE_HEADER only applies to pushed screens anyway, so a
 * top-level hero would have had no back affordance at all.
 */
export function HeroHeader({
  uri,
  title,
  subtitle,
  chip,
  action,
  onBack,
  height = 280,
  fallbackIcon,
}: {
  uri?: string | null;
  title: string;
  subtitle?: string;
  chip?: string;
  /** Secondary control at top-right: edit, share, overflow. */
  action?: React.ReactNode;
  onBack?: () => void;
  height?: number;
  fallbackIcon?: IconName;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // The photo grows by the inset instead of being pushed down by it: pushing leaves a band of
  // background above the image, which is the thing a full-bleed hero exists to avoid.
  const mediaHeight = height + insets.top;
  const controlTop = insets.top + t.spacing.sm;

  return (
    <View style={[styles.wrap, { height: mediaHeight }]}>
      <Img
        uri={uri}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        fallbackIcon={fallbackIcon}
        accessibilityLabel={title}
      />
      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/*
        The TOP vignette, and it is not decoration. This component runs under the status bar by
        design, so on a dark theme the OS draws LIGHT status text — over whatever the photo
        happens to be. Measured on the Wander build (2026-09-13): a bright sky put the top
        150px of this screen at mean luma 152 while every other screen in the app sat at 41,
        and the clock, wifi and battery glyphs were light-on-light. `onBack` and `action` float
        in the same band and were grey-on-bright.

        `vignetteColors` already existed for exactly this and `MapSurface` already uses it —
        the corpus read that produced it found the same two non-interactive vignettes on a
        shipped app's map screen. A hero is the same problem: floating UI over content the app
        does not control.

        It also happens to be what the owner's device report was about. A back gesture off this
        screen read as "a splash", because `slide_from_bottom` draws the incoming screen opaque
        from the first frame — so a 3.7x luminance step at the top of the display lands in one
        frame, with no transition able to soften it. The fix is the step, not the transition.
      */}
      <LinearGradient
        colors={vignetteColors(t, 'top')}
        style={[styles.topVignette, { height: insets.top + 120 }]}
        pointerEvents="none"
      />

      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={[
            styles.control,
            {
              top: controlTop,
              left: t.spacing.lg,
              borderRadius: t.radius.full,
              backgroundColor: MEDIA_CONTROL_BACKING,
            },
          ]}
        >
          <KitIcon name="back" size={22} color={t.palette.white} />
        </Pressable>
      ) : null}

      {action ? (
        <View style={[styles.control, styles.actionSlot, { top: controlTop, right: t.spacing.lg }]}>
          {action}
        </View>
      ) : null}

      {chip ? (
        <View
          style={[
            styles.chip,
            {
              left: t.spacing.lg,
              bottom: t.spacing.lg + 64,
              borderRadius: t.radius.full,
              backgroundColor: MEDIA_CONTROL_BACKING,
            },
          ]}
        >
          <Text style={[t.typography.caption, { color: t.palette.white, letterSpacing: 0.4 }]}>{chip}</Text>
        </View>
      ) : null}

      <View style={[styles.titleBlock, { left: t.spacing.lg, right: t.spacing.lg, bottom: t.spacing.lg }]}>
        <Text numberOfLines={2} style={[t.typography.h1, { color: t.palette.white }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[t.typography.body, { color: t.palette.white, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', position: 'relative', overflow: 'hidden' },
  // Top-anchored, so it cannot use absoluteFill — its height is set by the caller from the
  // safe-area inset, since what it has to cover is the status bar plus the control row.
  topVignette: { position: 'absolute', top: 0, left: 0, right: 0 },
  control: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  // The action slot holds a caller's own control, so it must not force a background behind it.
  actionSlot: { backgroundColor: 'transparent' },
  chip: { position: 'absolute', paddingHorizontal: 10, paddingVertical: 4 },
  titleBlock: { position: 'absolute' },
});
