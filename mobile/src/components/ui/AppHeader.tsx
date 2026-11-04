import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { KitIcon } from './Icon';
import { cappedTextScaling } from '@/theme/textScaling';

/**
 * FROZEN. The top app bar. It always sits BELOW the status bar / notch by
 * consuming the top safe-area inset, so screen content never bleeds under the
 * system UI. Two shapes, chosen by whether the screen can go back:
 *   - top-level (no `onBack`): a left-aligned large title — the app-name action
 *     bar every screen shows by default (see <Screen>, which defaults the title
 *     to APP_NAME).
 *   - pushed (`onBack` set): a compact centered title with a back button.
 */
export function AppHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const large = !onBack;

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, backgroundColor: t.palette.surface, borderBottomColor: t.palette.border },
      ]}
    >
      <View style={[styles.row, { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md }]}>
        {large ? null : (
          <View style={styles.side}>
            <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
              <KitIcon name="back" size={26} color={t.palette.text} />
            </Pressable>
          </View>
        )}
        <Text
          numberOfLines={1}
          style={[large ? t.typography.h1 : t.typography.h3, styles.fill, large ? undefined : styles.center, { color: t.palette.text }]}
          {...cappedTextScaling}
        >
          {title}
        </Text>
        {large ? (
          right ? <View style={styles.right}>{right}</View> : null
        ) : (
          <View style={[styles.side, styles.right]}>{right}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  side: { width: 48, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
});
