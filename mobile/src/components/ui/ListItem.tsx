import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, IconName, KitIcon } from './Icon';

/** FROZEN. Row with an optional leading icon, title/subtitle, and trailing chevron. */
export function ListItem({
  title,
  subtitle,
  leadingIcon,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  leadingIcon?: IconName;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const t = useTheme();
  const content = (
    <View
      style={[
        styles.row,
        { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.lg, gap: t.spacing.md },
      ]}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={22} color={t.palette.primary} /> : null}
      <View style={styles.body}>
        {/*
          The FACE comes from `label`, which is the 600 variant, not just the weight. A bare
          `fontWeight: '600'` over `body` asks a 400 face for semibold and gets a synthesised
          one — the same divergence the bundled faces exist to close, one layer up. With no
          custom typeface `label.fontFamily` is undefined and this is exactly what it was.
        */}
        <Text
          numberOfLines={1}
          style={[
            t.typography.body,
            { color: t.palette.text, fontWeight: '600', fontFamily: t.typography.label.fontFamily },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[t.typography.caption, { color: t.palette.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <KitIcon name="forward" size={20} color={t.palette.textMuted} /> : null)}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ backgroundColor: pressed ? t.palette.surfaceAlt : t.palette.surface }]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={{ backgroundColor: t.palette.surface }}>{content}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1 },
});
