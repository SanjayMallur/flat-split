import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/theme/tokens';
import { cappedTextScaling } from '@/theme/textScaling';

export type Ink = 'text' | 'muted' | 'accent' | 'onAccent' | 'danger';

export function inkColor(t: Theme, ink: Ink): string {
  switch (ink) {
    case 'muted':
      return t.palette.textMuted;
    case 'accent':
      return t.palette.primary;
    case 'onAccent':
      return t.palette.primaryText;
    case 'danger':
      return t.palette.danger;
    default:
      return t.palette.text;
  }
}

export type FigureSize = 'hero' | 'xl' | 'lg' | 'md' | 'sm';
const FIGURE_SIZES: Record<FigureSize, number> = { hero: 52, xl: 36, lg: 24, md: 17, sm: 14 };

/**
 * Every amount in this look: typewriter mono, so columns of money line up. The cents are split
 * off and set smaller and quieter, because a reader wants the dollars first.
 */
export function Figure({
  value,
  size = 'md',
  ink = 'text',
}: {
  value: string;
  size?: FigureSize;
  ink?: Ink;
}) {
  const t = useTheme();
  const fs = FIGURE_SIZES[size];
  const dot = value.lastIndexOf('.');
  const whole = dot >= 0 ? value.slice(0, dot) : value;
  const cents = dot >= 0 ? value.slice(dot) : '';
  const big = fs >= 24;
  return (
    <Text
      {...cappedTextScaling}
      numberOfLines={1}
      style={{ fontFamily: t.typography.label.fontFamily, fontSize: fs, lineHeight: Math.round(fs * 1.2), letterSpacing: -fs * 0.03, color: inkColor(t, ink) }}
    >
      {whole}
      {cents ? <Text style={{ fontSize: big ? Math.round(fs * 0.5) : fs, color: big ? t.palette.textMuted : inkColor(t, ink) }}>{cents}</Text> : null}
    </Text>
  );
}

/** Small mono capitals above a block. */
export function Eyebrow({ children, ink = 'muted' }: { children: React.ReactNode; ink?: Ink }) {
  const t = useTheme();
  return (
    <Text {...cappedTextScaling} style={[t.typography.label, { color: inkColor(t, ink) }]}>
      {children}
    </Text>
  );
}

/** A line in the old-bank serif. */
export function Display({
  children,
  size = 22,
  ink = 'text',
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  ink?: Ink;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text
      {...cappedTextScaling}
      numberOfLines={numberOfLines}
      style={{ fontFamily: t.typography.h1.fontFamily, fontSize: size, lineHeight: Math.round(size * 1.18), color: inkColor(t, ink) }}
    >
      {children}
    </Text>
  );
}

/** A serif title, a mono action, and a thin rule under both: a heading in an account book. */
export function SectionHead({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: t.spacing.xxl,
        paddingBottom: t.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: t.palette.border,
      }}
    >
      <Text {...cappedTextScaling} style={[t.typography.h2, { color: t.palette.text }]}>
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Eyebrow ink="accent">{action}</Eyebrow>
        </Pressable>
      ) : null}
    </View>
  );
}
