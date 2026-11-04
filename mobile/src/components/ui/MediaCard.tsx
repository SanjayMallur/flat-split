import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { Img } from './Img';
import { MEDIA_CONTROL_BACKING, SCRIM_COLORS, SCRIM_LOCATIONS } from './media';
import { useEnterTransition, usePressScale } from './motion';
import type { IconName } from './Icon';

/**
 * FROZEN. A photo card with its title written ON the image.
 *
 * THE COMPOSITION THE KIT WAS MISSING, and the reason this file exists rather than another
 * primitive. The kit shipped 52 atoms and no molecules, so a screen that needed "photo with a
 * title on it" had to assemble one — and on the Wander build the SAME RUN produced two
 * different answers: `TripDetailScreen` hand-rolled `<Img>` + an absolutely-filled
 * `<LinearGradient>` + absolutely-positioned `<Text>` in 22 lines, while `TripCard` stacked
 * the image above a padded text block. One design problem, two answers, one app. That is the
 * N-independent-calls failure this codebase has already solved three times (`app_name`,
 * `sample_data`, the tab bar) and solved the same way each time: decide it once, in code.
 *
 * The shape is measured, not designed here. Of 52 card components across 36 Rork-exported
 * apps, 18 carry an image and 12 of those — two thirds — put a gradient over it with the
 * title, a chip and an action positioned on top (§9.25). The four overlay slots below are
 * those positions.
 *
 * `footer` is for the ONE metric that belongs under the media rather than on it. Resist
 * putting the title there: a title under the photo is the layout this component replaces.
 */
export function MediaCard({
  uri,
  title,
  subtitle,
  chip,
  overline,
  action,
  footer,
  height = 220,
  fallbackIcon,
  onPress,
  accessibilityLabel,
  index = 0,
}: {
  uri?: string | null;
  title: string;
  subtitle?: string;
  /** Status or category, drawn on the image at top-left. */
  chip?: string;
  /** Small editorial mark at bottom-right — an index, a distance, a count. */
  overline?: string;
  /** Secondary control at top-right: favourite, overflow, share. */
  action?: React.ReactNode;
  /** One metric, below the media. */
  footer?: React.ReactNode;
  height?: number;
  fallbackIcon?: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Position in its list. Staggers the arrival so rows appear in sequence. */
  index?: number;
}) {
  const t = useTheme();
  const press = usePressScale(0.99);
  const enter = useEnterTransition(index);

  const body = (
    <Animated.View
      style={[
        styles.card,
        enter.style,
        press.style,
        {
          borderRadius: t.radius.lg,
          backgroundColor: t.palette.surface,
          borderColor: t.palette.border,
        },
      ]}
    >
      <View style={[styles.media, { height }]}>
        <Img
          uri={uri}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          fallbackIcon={fallbackIcon}
          accessibilityLabel={accessibilityLabel ?? title}
        />
        {/* pointerEvents none so the scrim never eats the card's own press */}
        <LinearGradient
          colors={SCRIM_COLORS}
          locations={SCRIM_LOCATIONS}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {chip ? (
          <View
            style={[
              styles.chip,
              {
                top: t.spacing.md,
                left: t.spacing.md,
                borderRadius: t.radius.full,
                // Black, not the page colour — and that reverses a call made here on
                // 2026-09-12 ("a fixed black pill on a cream theme reads as a hole punched in
                // the page"). The page-coloured pill it chose put WHITE text on a cream pill,
                // unreadable on every light theme; the mockup has always drawn this pill black
                // and the owner chose black for anything white on a photo (D1, 2026-09-18).
                backgroundColor: MEDIA_CONTROL_BACKING,
              },
            ]}
          >
            <Text style={[t.typography.caption, styles.chipLabel, { color: t.palette.white }]}>
              {chip}
            </Text>
          </View>
        ) : null}

        {action ? <View style={[styles.action, { top: t.spacing.md, right: t.spacing.md }]}>{action}</View> : null}

        {overline ? (
          <Text
            style={[
              t.typography.caption,
              styles.overline,
              { bottom: t.spacing.md, right: t.spacing.md, color: t.palette.white },
            ]}
          >
            {overline}
          </Text>
        ) : null}

        <View
          style={[
            styles.titleBlock,
            { left: t.spacing.lg, right: t.spacing.lg, bottom: t.spacing.lg, gap: 2 },
          ]}
        >
          <Text numberOfLines={2} style={[t.typography.h2, { color: t.palette.white }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[t.typography.caption, { color: t.palette.white }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {footer ? <View style={{ padding: t.spacing.md }}>{footer}</View> : null}
    </Animated.View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `overflow: hidden` is what keeps the image inside the rounded corner. Without it the
  // photo squares off the card at every corner and the radius is decorative only.
  card: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  media: { width: '100%', position: 'relative' },
  chip: { position: 'absolute', paddingHorizontal: 10, paddingVertical: 4 },
  chipLabel: { letterSpacing: 0.4 },
  action: { position: 'absolute' },
  overline: { position: 'absolute', opacity: 0.85 },
  titleBlock: { position: 'absolute' },
});
