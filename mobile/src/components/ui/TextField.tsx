import React from 'react';
import { TextField as HTextField, Input } from 'heroui-native';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** FROZEN. Labeled text input with error + helper text. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  secureTextEntry,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const t = useTheme();
  return (
    <View className="gap-1">
      {label ? <Text style={[t.typography.label, { color: t.palette.text }]}>{label}</Text> : null}
      <HTextField isInvalid={!!error}>
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          className={multiline ? 'min-h-24' : undefined}
          style={multiline ? { textAlignVertical: 'top' } : undefined}
        />
      </HTextField>
      {error ? (
        <Text style={[t.typography.caption, { color: t.palette.danger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[t.typography.caption, { color: t.palette.textMuted }]}>{helper}</Text>
      ) : null}
    </View>
  );
}
