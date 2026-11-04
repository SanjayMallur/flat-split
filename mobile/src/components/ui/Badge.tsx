import React from 'react';
import { Chip } from 'heroui-native';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

/**
 * A badge is a status marker, not a call to action — a wall of solid pills
 * out-shouts the primary action on the screen. Solid is also the less legible
 * choice: the default `*-foreground` is white over a light status colour, so
 * measured on `--surface` the fixed tones sit at success 2.22 and warning 2.20,
 * failing WCAG AA even at large-text size. Soft's derived `*-soft-foreground`
 * lifts them to 3.60 and 3.98 (danger 3.55 -> 4.01; the accent pair depends on
 * the per-app accent, 4.02 -> 4.48 for the default blue).
 *
 * Still short of AA's 4.5 at this 12px label — the legibility floor that binds
 * every tone is the theming track's job, not this table's. Soft is strictly the
 * better end of what the two heroui variants offer.
 *
 * Soft survives per-project theming because heroui derives `--color-*-soft` from
 * `--accent`/`--success`/`--warning`/`--danger` with `color-mix`
 * (`heroui-native/styles/theme.css`) rather than hardcoding a palette.
 *
 * `neutral` is the odd one out and was already soft: heroui maps soft+default to
 * a full-strength `--default` fill (not `--default-soft`) with the plain
 * `--default-foreground` label. That is the grey pill, and it is correct — the
 * four tone changes here are the coloured ones.
 */
const toneProps: Record<Tone, { variant: 'soft'; color: 'default' | 'accent' | 'success' | 'warning' | 'danger' }> = {
  neutral: { variant: 'soft', color: 'default' },
  primary: { variant: 'soft', color: 'accent' },
  success: { variant: 'soft', color: 'success' },
  warning: { variant: 'soft', color: 'warning' },
  danger: { variant: 'soft', color: 'danger' },
};

/** FROZEN. Small status pill. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { variant, color } = toneProps[tone];
  return (
    <Chip size="sm" variant={variant} color={color} className="self-start">
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
