import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { KitIcon } from './Icon';
import { Button } from './Button';

/** FROZEN. Full-screen error with an optional retry. Use for a failed query. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md, padding: t.spacing.xl }}>
      <KitIcon name="alert" size={44} color={t.palette.danger} />
      <Text style={[t.typography.h3, { color: t.palette.text, textAlign: 'center' }]}>Something went wrong</Text>
      <Text style={[t.typography.body, { color: t.palette.textMuted, textAlign: 'center' }]}>
        {message ?? 'Please try again.'}
      </Text>
      {onRetry ? <Button title="Retry" kitIcon="refresh" variant="secondary" fullWidth={false} onPress={onRetry} /> : null}
    </View>
  );
}
