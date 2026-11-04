import React from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Img } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { usePressScale } from '@/components/ui/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { cappedTextScaling } from '@/theme/textScaling';
import { Eyebrow } from './type';

/** Tally's page top, for `<Screen header={false}>`: a mono eyebrow and a serif title on the green. */
export function TallyTopBar({
  eyebrow,
  title,
  right,
  onBack,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
        {onBack ? <IconButton icon="arrow-left" onPress={onBack} label="Go back" /> : <Eyebrow>{eyebrow}</Eyebrow>}
        {right}
      </View>
      {onBack && eyebrow ? (
        <View style={{ marginTop: t.spacing.md }}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </View>
      ) : null}
      <Text {...cappedTextScaling} style={[t.typography.h1, { color: t.palette.text, marginTop: t.spacing.xs }]}>
        {title}
      </Text>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 40,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  size?: number;
}) {
  const t = useTheme();
  const press = usePressScale(0.94);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          press.style,
          {
            width: size,
            height: size,
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.palette.border,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <Icon name={icon} size={Math.round(size * 0.48)} color={t.palette.text} />
      </Animated.View>
    </Pressable>
  );
}

/** A merchant or account: its initial in the serif, in a square seal. Tally has no logos. */
export function Monogram({ letter, size = 40, tone = 'plain' }: { letter: string; size?: number; tone?: 'plain' | 'accent' }) {
  const t = useTheme();
  const accent = tone === 'accent';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: accent ? t.palette.primary : t.palette.surfaceAlt,
      }}
    >
      <Text
        {...cappedTextScaling}
        style={{ fontFamily: t.typography.h1.fontFamily, fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.62), color: accent ? t.palette.primaryText : t.palette.text }}
      >
        {letter}
      </Text>
    </View>
  );
}

/** A face in a brass frame, like a portrait on a note. The only photo in the look. */
export function Avatar({ uri, size = 72, name }: { uri?: string | null; size?: number; name: string }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.palette.primary, padding: 3 }}>
      <Img uri={uri} accessibilityLabel={name} fallbackIcon="user" style={{ flex: 1, borderRadius: t.radius.sm }} />
    </View>
  );
}
