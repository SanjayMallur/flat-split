import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Img } from './Img';
import { KitIcon } from './Icon';
import type { IconName } from './Icon';

/**
 * FROZEN. The card that appears when something on a map (or any canvas) is selected.
 *
 * A SELECTED THING NEEDS A SURFACE, and this is the piece whose absence was visible: tapping
 * a point on the Wander build's map produced an unstyled line of text with no background and
 * no way to dismiss it, where the approved mockup showed a card. The corpus answer is a
 * floating panel with a thumbnail, a title, a close control and a tap-through to the detail
 * screen (RESEARCH-beautiful-mobile-frontends §9.25).
 *
 * It draws the CHROME only. Its position and its entrance are `MapSurface`'s, because an
 * exit animation requires the child to stay mounted after `selected` goes null and a
 * component cannot animate its own unmounting.
 */
export function SelectedCard({
  title,
  subtitle,
  detail,
  imageUri,
  fallbackIcon,
  onPress,
  onClose,
}: {
  title: string;
  subtitle?: string;
  /** One more line — a note, a distance, a date. */
  detail?: string;
  imageUri?: string | null;
  fallbackIcon?: IconName;
  /** Tap the card to open the full record. */
  onPress?: () => void;
  /** Dismiss. Omit it and the only way out is tapping the canvas. */
  onClose?: () => void;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      style={[
        styles.card,
        {
          borderRadius: t.radius.lg,
          backgroundColor: t.palette.surface,
          borderColor: t.palette.border,
          padding: t.spacing.md,
          gap: t.spacing.md,
        },
      ]}
    >
      {imageUri !== undefined ? (
        <Img
          uri={imageUri}
          style={{ width: 52, height: 52, borderRadius: t.radius.md }}
          contentFit="cover"
          fallbackIcon={fallbackIcon}
        />
      ) : null}

      <View style={styles.body}>
        <Text numberOfLines={1} style={[t.typography.h3, { color: t.palette.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[t.typography.caption, { color: t.palette.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text numberOfLines={2} style={[t.typography.caption, { color: t.palette.text }]}>
            {detail}
          </Text>
        ) : null}
      </View>

      {onClose ? (
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.close}
        >
          <KitIcon name="close" size={18} color={t.palette.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, gap: 2 },
  close: { alignSelf: 'flex-start' },
});
