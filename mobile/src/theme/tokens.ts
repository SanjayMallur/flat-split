/**
 * Design tokens — the single source of visual truth for the app.
 *
 * FROZEN and STATIC. All UI-kit components read from here; restyling the whole app is a
 * change to the project's theme, never a component rewrite.
 *
 * The VALUES live in `theme.generated.ts`, which the pipeline rewrites per project. This
 * file only assembles them and pins them to the `Theme` contract, so:
 *   - a template upgrade never has to merge around a project's colours, and
 *   - a theme with a wrong or missing key fails `tsc` at its own definition, not inside
 *     some unrelated component that happened to read the missing key.
 *
 * The generated file's default values follow DESIGN.md (repo root).
 */

import { iconSet, mode, palette, spacing, radius, typography, shadow } from './theme.generated';
import type { Theme } from './contract';

export { iconSet, mode, palette, spacing, radius, typography, shadow };
export type {
  IconSet,
  Palette,
  Radius,
  Shadow,
  ShadowStyle,
  Spacing,
  Theme,
  ThemeMode,
  TypeVariant,
  Typography,
} from './contract';

export const theme: Theme = { mode, iconSet, palette, spacing, radius, typography, shadow };
