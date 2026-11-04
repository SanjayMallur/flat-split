import React from 'react';
import { View, Text } from 'react-native';
import { Spinner } from 'heroui-native';
import { useTheme } from '@/theme/ThemeProvider';

/** FROZEN. Centered loading indicator. Use while a query is pending. */
export function LoadingState({ message }: { message?: string }) {
  const t = useTheme();
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Spinner size="lg" color={t.palette.primary} />
      {message ? <Text style={[t.typography.body, { color: t.palette.textMuted }]}>{message}</Text> : null}
    </View>
  );
}
