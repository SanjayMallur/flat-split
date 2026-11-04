import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { cappedTextScaling } from '@/theme/textScaling';
import { Eyebrow, Figure } from './type';
import { Leader } from './blocks';

/** A thin brass line over a soft fill, with the latest point marked. For a balance over time. */
export function TrendLine({
  points,
  width = 320,
  height = 64,
  labels,
}: {
  points: number[];
  width?: number;
  height?: number;
  labels?: string[];
}) {
  const t = useTheme();
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 6;
  const span = Math.max(1, max - min);
  const at = (v: number, i: number) => [
    pad + (i / Math.max(1, points.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ];
  const coords = points.map(at);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  const area = `${line} L${lastX.toFixed(1)} ${height} L${coords[0][0].toFixed(1)} ${height} Z`;
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="tallyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.palette.primary} stopOpacity={0.28} />
            <Stop offset="1" stopColor={t.palette.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#tallyFill)" />
        <Path d={line} stroke={t.palette.primary} strokeWidth={1.6} fill="none" />
        <Circle cx={lastX} cy={lastY} r={3.5} fill={t.palette.primary} />
      </Svg>
      {labels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {labels.map((label) => (
            <Eyebrow key={label}>{label}</Eyebrow>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type Slice = { label: string; value: string; fraction: number };

/** Where the money went: a thin ring in brass, cream and two greens, the total in the middle. */
export function SpendDonut({ slices, total, caption, size = 196 }: { slices: Slice[]; total: string; caption: string; size?: number }) {
  const t = useTheme();
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const colors = [t.palette.primary, t.palette.text, t.palette.success, t.palette.textMuted];
  let offset = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          {slices.map((s, i) => {
            const length = s.fraction * c;
            const node = (
              <Circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={colors[i % colors.length]}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, length - 3)} ${c - Math.max(0, length - 3)}`}
                strokeDashoffset={-offset}
                fill="none"
              />
            );
            offset += length;
            return node;
          })}
        </Svg>
        <Figure value={total} size="xl" />
        <Eyebrow>{caption}</Eyebrow>
      </View>
      <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
        {slices.map((s, i) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 7 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, marginRight: 8, marginBottom: 5, backgroundColor: colors[i % colors.length] }} />
            <Text {...cappedTextScaling} style={[t.typography.h3, { color: t.palette.text }]}>
              {s.label}
            </Text>
            <Leader />
            <Figure value={s.value} size="md" />
          </View>
        ))}
      </View>
    </View>
  );
}
