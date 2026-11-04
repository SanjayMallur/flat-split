import React from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, IconName, KitIcon, KitIconName } from './Icon';
import { useScreenBottomInset } from './useScreenBottomInset';

/**
 * FROZEN. Vertical space a scroll/list must reserve at its bottom so its last row
 * clears the floating FAB (FAB min height 56 + its bottom offset spacing.xl 24).
 * Screen and list screens add `useScreenBottomInset()` on top of this.
 */
export const FAB_CLEARANCE = 80;

/**
 * FROZEN. Floating action button, bottom-right; grows to a pill when `label` is
 * set. Lifts itself above whatever system chrome sits under it — see
 * `useScreenBottomInset` for why that is nothing on a tab screen.
 */
export function FAB({
  icon,
  kitIcon,
  onPress,
  label,
}: {
  icon?: IconName;
  /** For the FROZEN kit and the shipped example screen: a family-agnostic glyph. A literal
   * family name here would not compile once `iconSet` is themed away from the default. */
  kitIcon?: KitIconName;
  onPress: () => void;
  label?: string;
}) {
  const t = useTheme();
  const bottomInset = useScreenBottomInset();
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onPress();
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Add'}
      style={({ pressed }) => [
        styles.fab,
        t.shadow.raised,
        {
          backgroundColor: t.palette.primary,
          borderRadius: t.radius.full,
          paddingHorizontal: label ? t.spacing.lg : t.spacing.md,
          right: t.spacing.lg,
          bottom: bottomInset + t.spacing.xl,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {icon ? (
        <Icon name={icon} size={22} color={t.palette.primaryText} />
      ) : (
        <KitIcon name={kitIcon ?? 'add'} size={22} color={t.palette.primaryText} />
      )}
      {label ? <Text style={[t.typography.label, { color: t.palette.primaryText }]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    minHeight: 56,
    minWidth: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
