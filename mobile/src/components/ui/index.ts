// FROZEN. Barrel export for the UI kit — screens import from '@/components/ui'.
export { Icon, KitIcon } from './Icon';
export type { IconName, KitIconName } from './Icon';
export { Img } from './Img';
export { Screen } from './Screen';
export { AppHeader } from './AppHeader';
export { Button } from './Button';
export { FAB, FAB_CLEARANCE } from './FAB';
export { useScreenBottomInset } from './useScreenBottomInset';
export { Card } from './Card';
export { ListItem } from './ListItem';
export { TextField } from './TextField';
export { Badge } from './Badge';
export { Section } from './Section';
export { LoadingState } from './LoadingState';
export { ErrorState } from './ErrorState';
export { EmptyState } from './EmptyState';
// Compositions (§9.25): the kit shipped 52 atoms and no molecules, so every screen that
// needed a photo card, a hero or a map assembled its own — differently each time.
//
// `motion.ts` is deliberately NOT here. Motion lives INSIDE these components — a screen
// calling `usePressScale` is a screen hand-rolling a pressable, which is the drift
// `validate_mobile_kit_discipline()` exists to catch.
export { MediaCard } from './MediaCard';
export { HeroHeader } from './HeroHeader';
export { MapSurface } from './MapSurface';
export type { MapPoint } from './MapSurface';
export { SelectedCard } from './SelectedCard';
