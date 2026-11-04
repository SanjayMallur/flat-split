import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, IconName, KitIcon } from './Icon';
import { Button } from './Button';

/** FROZEN. Friendly empty placeholder with an optional call-to-action. */
export function EmptyState({
  icon,
  title,
  hint,
  cta,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  cta?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md, padding: t.spacing.xl }}>
      {/* The DEFAULT has to be family-agnostic: `file-tray-outline` is an Ionicons name and
          would not compile under Feather. A caller-supplied icon is still its own family's. */}
      {icon ? (
        <Icon name={icon} size={48} color={t.palette.textMuted} />
      ) : (
        <KitIcon name="empty" size={48} color={t.palette.textMuted} />
      )}
      <Text style={[t.typography.h3, { color: t.palette.text, textAlign: 'center' }]}>{title}</Text>
      {hint ? (
        <Text style={[t.typography.body, { color: t.palette.textMuted, textAlign: 'center' }]}>{hint}</Text>
      ) : null}
      {cta ? <Button title={cta.label} kitIcon="add" fullWidth={false} onPress={cta.onPress} /> : null}
    </View>
  );
}
