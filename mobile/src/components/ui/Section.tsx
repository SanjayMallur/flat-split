import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** FROZEN. A titled group of content with consistent spacing. */
export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.xl }}>
      {title ? (
        <Text style={[t.typography.label, { color: t.palette.textMuted, textTransform: 'uppercase' }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
