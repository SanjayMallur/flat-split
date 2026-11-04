import React from 'react';
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';
import { iconSet } from '@/theme/tokens';
import type { IconSet } from '@/theme/contract';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * FROZEN. Thin, typed wrapper over the app's glyph family so icon names are checked by tsc.
 *
 * WHY THIS IS A CONDITIONAL TYPE AND NOT A UNION. Widening `IconName` to
 * `keyof Ionicons.glyphMap | keyof Feather.glyphMap | …` would accept a Feather name in an
 * app rendering Ionicons: the name typechecks, the glyph does not exist, and the screen
 * shows a blank box that no check catches. Keying the type off the GENERATED literal keeps
 * the guarantee the frozen kit exists for — only names the ACTIVE family has will compile.
 */
const GLYPH_FAMILIES = {
  ionicons: Ionicons,
  material: MaterialIcons,
  'material-community': MaterialCommunityIcons,
  feather: Feather,
} as const;

type GlyphMapFor<S extends IconSet> = S extends 'ionicons'
  ? typeof Ionicons.glyphMap
  : S extends 'material'
    ? typeof MaterialIcons.glyphMap
    : S extends 'material-community'
      ? typeof MaterialCommunityIcons.glyphMap
      : typeof Feather.glyphMap;

export type IconName = Extract<keyof GlyphMapFor<typeof iconSet>, string>;

/**
 * The glyphs the FROZEN kit itself draws, by what they MEAN.
 *
 * The kit cannot name a family's glyph directly. `chevron-back` exists in Ionicons and not
 * in Feather, so the moment `iconSet` became themeable, every frozen component that named an
 * Ionicons glyph turned into a `tsc` error in a file the user is not allowed to edit —
 * selecting any non-default family bricked the template. Verified before fixing: choosing
 * `feather` produced six unrepairable errors across AppHeader, EmptyState and ErrorState.
 *
 * So the kit asks for a MEANING and this table resolves it per family. A screen still names
 * its own family's glyphs through `IconName`, which is checked against the active family —
 * that guarantee is the point and it is untouched.
 */
const KIT_GLYPHS = {
  back: {
    ionicons: 'chevron-back', material: 'chevron-left',
    'material-community': 'chevron-left', feather: 'chevron-left',
  },
  forward: {
    ionicons: 'chevron-forward', material: 'chevron-right',
    'material-community': 'chevron-right', feather: 'chevron-right',
  },
  add: {
    ionicons: 'add', material: 'add', 'material-community': 'plus', feather: 'plus',
  },
  refresh: {
    ionicons: 'refresh', material: 'refresh',
    'material-community': 'refresh', feather: 'refresh-cw',
  },
  alert: {
    ionicons: 'alert-circle-outline', material: 'error-outline',
    'material-community': 'alert-circle-outline', feather: 'alert-circle',
  },
  empty: {
    ionicons: 'file-tray-outline', material: 'inbox',
    'material-community': 'tray-remove', feather: 'inbox',
  },
  remove: {
    ionicons: 'trash-outline', material: 'delete-outline',
    'material-community': 'trash-can-outline', feather: 'trash-2',
  },
  placeholder: {
    ionicons: 'ellipse-outline', material: 'circle',
    'material-community': 'circle-outline', feather: 'circle',
  },
  image: {
    ionicons: 'image-outline', material: 'image',
    'material-community': 'image-outline', feather: 'image',
  },
  // Dismiss, not delete. `remove` is a bin and means the record is gone; a floating panel
  // needs "put this away", and `SelectedCard` was the first kit component to need one.
  close: {
    ionicons: 'close', material: 'close',
    'material-community': 'close', feather: 'x',
  },
  // A map pin the kit can draw itself — `MapSurface`'s default marker. Named by meaning for
  // the same reason as the rest: `location` exists in Ionicons and Feather calls it `map-pin`.
  pin: {
    ionicons: 'location', material: 'place',
    'material-community': 'map-marker', feather: 'map-pin',
  },
} as const satisfies Record<string, Record<IconSet, string>>;

export type KitIconName = keyof typeof KIT_GLYPHS;

/**
 * The font map `App.tsx` preloads.
 *
 * Icons render as tofu boxes for the first frame if the glyph font arrives after it — the
 * bug class PR-4b burned on. Widening the family while the preload stayed hardcoded to
 * `Ionicons.font` would have reopened it for every app that picked a different one, which
 * is exactly what T31 warns about.
 */
export const activeIconFont = GLYPH_FAMILIES[iconSet].font;

/** The four families share a prop shape but not a name union, so the dispatch is typed by
 * that shape rather than by one of them. `IconName` / `KitIconName` are what constrain the
 * callers; this cast only picks a component. */
type GlyphComponent = React.ComponentType<{ name: string; size: number; color: string }>;

function renderGlyph(glyph: string, size: number, color: string) {
  const Family = GLYPH_FAMILIES[iconSet] as unknown as GlyphComponent;
  return <Family name={glyph} size={size} color={color} />;
}

export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return renderGlyph(name, size, color ?? theme.palette.text);
}

/** For the FROZEN kit only. Screens use `Icon` with their own family's names. */
export function KitIcon({
  name,
  size = 22,
  color,
}: {
  name: KitIconName;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return renderGlyph(KIT_GLYPHS[name][iconSet], size, color ?? theme.palette.text);
}
