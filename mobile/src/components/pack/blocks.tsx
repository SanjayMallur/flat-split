import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { Icon } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { usePressScale } from '@/components/ui/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { cappedTextScaling } from '@/theme/textScaling';
import { Display, Eyebrow, Figure } from './type';
import type { Ink } from './type';
import { Monogram } from './chrome';

function PressScale({ onPress, children, label }: { onPress?: () => void; children: React.ReactNode; label?: string }) {
  const press = usePressScale(0.985);
  if (!onPress) return <>{children}</>;
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={press.style}>{children}</Animated.View>
    </Pressable>
  );
}

/** The fine engraved rings of a banknote, drawn in brass behind the figure. */
function Guilloche({ color }: { color: string }) {
  const rings = Array.from({ length: 14 }, (_, i) => i);
  return (
    <Svg width={240} height={190} style={{ position: 'absolute', right: -50, top: -40 }} pointerEvents="none">
      {rings.map((i) => (
        <Ellipse
          key={i}
          cx={120}
          cy={95}
          rx={112}
          ry={40}
          stroke={color}
          strokeOpacity={0.24}
          strokeWidth={0.7}
          fill="none"
          transform={`rotate(${i * 13} 120 95)`}
        />
      ))}
    </Svg>
  );
}

/**
 * The look's signature: the one number that matters, on a framed note with engraved rings. A thin
 * brass frame sits inside the card's edge, as on real money. One per screen.
 */
export function BanknoteCard({
  eyebrow,
  value,
  meta,
  children,
}: {
  eyebrow: string;
  value: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.palette.surface, borderRadius: t.radius.lg, padding: 20, overflow: 'hidden' }}>
      <Guilloche color={t.palette.primary} />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.palette.primary, opacity: 0.4 }}
      />
      <Eyebrow ink="accent">{eyebrow}</Eyebrow>
      <View style={{ marginTop: 10 }}>
        <Figure value={value} size="hero" ink="accent" />
      </View>
      {meta ? (
        <Text {...cappedTextScaling} style={[t.typography.body, { color: t.palette.text, marginTop: 6 }]}>
          {meta}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Dots from a name to its amount, as in a printed account book. Real views, so every platform draws them. */
export function Leader() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, height: 2, flexDirection: 'row', overflow: 'hidden', gap: 3, marginHorizontal: 6, marginBottom: 4, alignSelf: 'flex-end' }}>
      {Array.from({ length: 60 }, (_, i) => (
        <View key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: t.palette.textMuted, opacity: 0.55 }} />
      ))}
    </View>
  );
}

/** One line of the ledger: seal, name, dotted leader, amount; money in is brass. */
export function LedgerRow({
  letter,
  name,
  meta,
  amount,
  income = false,
  last = false,
  onPress,
}: {
  letter: string;
  name: string;
  meta?: string;
  amount: string;
  income?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <PressScale onPress={onPress} label={name}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 11,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: t.palette.border,
        }}
      >
        <Monogram letter={letter} tone={income ? 'accent' : 'plain'} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text {...cappedTextScaling} numberOfLines={1} style={[t.typography.h3, { color: t.palette.text, flexShrink: 1 }]}>
              {name}
            </Text>
            <Leader />
            <Figure value={amount} size="md" ink={income ? 'accent' : 'text'} />
          </View>
          {meta ? (
            <Text {...cappedTextScaling} numberOfLines={1} style={[t.typography.caption, { color: t.palette.textMuted, marginTop: 1 }]}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </PressScale>
  );
}

/** A budget envelope: how much of it has gone. Over the limit, the bar and figure turn red. */
export function EnvelopeBar({
  name,
  spent,
  limit,
  fraction,
  note,
}: {
  name: string;
  spent: string;
  limit: string;
  fraction: number;
  note?: string;
}) {
  const t = useTheme();
  const over = fraction > 1;
  const ink: Ink = over ? 'danger' : 'text';
  return (
    <View style={{ paddingVertical: 11 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text {...cappedTextScaling} style={[t.typography.h3, { color: t.palette.text }]}>
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Figure value={spent} size="sm" ink={ink} />
          <Eyebrow>{`of ${limit}`}</Eyebrow>
        </View>
      </View>
      <View style={{ height: 6, marginTop: 8, borderRadius: 2, backgroundColor: t.palette.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(Math.min(1, fraction) * 100)}%`, height: '100%', backgroundColor: over ? t.palette.danger : t.palette.primary }} />
      </View>
      {note ? (
        <Text {...cappedTextScaling} style={[t.typography.caption, { color: over ? t.palette.danger : t.palette.textMuted, marginTop: 5 }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** The one light thing in a dark look: cream paper with a torn bottom edge, set in the mono. */
export function ReceiptCard({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const teeth = Array.from({ length: 24 }, (_, i) => i);
  return (
    <View>
      <View style={{ backgroundColor: t.palette.text, borderTopLeftRadius: t.radius.md, borderTopRightRadius: t.radius.md, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 12 }}>
        {children}
      </View>
      <View style={{ flexDirection: 'row', height: 8, overflow: 'hidden' }}>
        {teeth.map((i) => (
          <View key={i} style={{ flex: 1, height: 16, marginTop: -8, backgroundColor: t.palette.text, transform: [{ rotate: '45deg' }, { scale: 0.72 }] }} />
        ))}
      </View>
    </View>
  );
}

/** A row on the receipt. `strong` is the total. */
export function ReceiptLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const t = useTheme();
  const style = {
    fontFamily: t.typography.label.fontFamily,
    fontSize: strong ? 20 : 14,
    lineHeight: strong ? 26 : 22,
    color: t.palette.textInverse,
  };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text {...cappedTextScaling} style={[style, { flexShrink: 1 }]}>
        {label}
      </Text>
      <Text {...cappedTextScaling} style={style}>
        {value}
      </Text>
    </View>
  );
}

/** A dashed cut across the receipt. Real views, so every platform draws them. */
export function ReceiptCut() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', overflow: 'hidden', gap: 4, height: 1, marginVertical: 12 }}>
      {Array.from({ length: 60 }, (_, i) => (
        <View key={i} style={{ width: 5, height: 1, backgroundColor: t.palette.textInverse, opacity: 0.5 }} />
      ))}
    </View>
  );
}

/** The full-width action: brass, near-square, a serif label. */
export function TallyButton({
  label,
  onPress,
  variant = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  icon?: IconName;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  return (
    <PressScale onPress={onPress} label={label}>
      <View
        style={{
          height: 54,
          borderRadius: t.radius.md,
          backgroundColor: primary ? t.palette.primary : 'transparent',
          borderWidth: primary ? 0 : 1,
          borderColor: t.palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {icon ? <Icon name={icon} size={18} color={primary ? t.palette.primaryText : t.palette.text} /> : null}
        <Display size={18} ink={primary ? 'onAccent' : 'text'}>
          {label}
        </Display>
      </View>
    </PressScale>
  );
}

export type StripItem = { label: string; value: string; ink?: Ink };

/** Two or three figures side by side under mono labels, split by hairlines. No box round them. */
export function FigureStrip({ items, size = 'lg' }: { items: StripItem[]; size?: 'lg' | 'md' }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.palette.border }}>
      {items.map((item, i) => (
        <View
          key={item.label}
          style={{ flex: 1, paddingVertical: 12, paddingLeft: i === 0 ? 0 : 12, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: t.palette.border }}
        >
          <Eyebrow>{item.label}</Eyebrow>
          <View style={{ marginTop: 4 }}>
            <Figure value={item.value} size={size} ink={item.ink ?? 'text'} />
          </View>
        </View>
      ))}
    </View>
  );
}
