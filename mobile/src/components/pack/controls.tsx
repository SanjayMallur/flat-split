import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { cappedTextScaling } from '@/theme/textScaling';
import { Display } from './type';

/** Period or filter switch: plain text with a brass underline, the way a ledger marks a column. */
export function UnderlineTabs({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: t.palette.border }}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: on ? t.palette.primary : 'transparent' }}
          >
            <Text {...cappedTextScaling} style={[t.typography.h3, { color: on ? t.palette.text : t.palette.textMuted }]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Which envelope: a scrolling row of outlined chips; the chosen one is filled brass. */
export function CategoryChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              height: 36,
              paddingHorizontal: 13,
              borderRadius: t.radius.sm,
              borderWidth: 1,
              borderColor: on ? t.palette.primary : t.palette.border,
              backgroundColor: on ? t.palette.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text {...cappedTextScaling} style={[t.typography.h3, { fontSize: 13, color: on ? t.palette.primaryText : t.palette.text }]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

/** A form's main value on an adding machine: the keys are the form. Writes a plain string. */
export function AmountPad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useTheme();
  const press = (key: string) => {
    if (key === 'back') return onChange(value.slice(0, -1));
    if (key === '.' && value.includes('.')) return;
    if (value.includes('.') && value.length - value.indexOf('.') > 2) return;
    onChange(value + key);
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => press(key)}
          accessibilityRole="button"
          accessibilityLabel={key === 'back' ? 'Delete' : key}
          style={{
            flexBasis: '31%',
            flexGrow: 1,
            height: 52,
            borderRadius: t.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.palette.surface,
          }}
        >
          {key === 'back' ? (
            <Icon name="delete" size={20} color={t.palette.text} />
          ) : (
            <Text {...cappedTextScaling} style={{ fontFamily: t.typography.label.fontFamily, fontSize: 22, lineHeight: 28, color: t.palette.text }}>
              {key}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** A plain settings or account row, with a chevron. */
export function PlainRow({ title, last = false, onPress }: { title: string; last?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 50,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.palette.border,
      }}
    >
      <Text {...cappedTextScaling} style={[t.typography.body, { color: t.palette.text }]}>
        {title}
      </Text>
      <Icon name="chevron-right" size={18} color={t.palette.textMuted} />
    </Pressable>
  );
}

