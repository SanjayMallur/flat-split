// FROZEN. Extended kit façade — the heroui-native surface the frozen barrel does NOT wrap.
//
// `index.ts` exposes 15 policy-bearing wrappers; five of them add Naapy policy (stable props,
// variant remapping, haptics, `useTheme()`) over SIX heroui-native components — Button→Button,
// Card→Card, TextField→TextField+Input (the wrapper skins both), Badge→Chip, LoadingState→Spinner.
// heroui-native@1.0.8 ships 43 components in all, so 43 − 6 = 37 remain. Those 37 are installed
// and themed by the App-root `HeroUINativeProvider`; this file re-exports them raw, so a
// hand-written screen can `import { BottomSheet, Switch, Tabs } from '@/components/ui/kit'`.
//
// Every name below must be a REAL export of heroui-native@1.0.8. `tsconfig` compiles `**/*.ts`,
// so this file is typechecked by every generated app's build gate whether or not any screen
// imports it — and it is FROZEN, so a wrong name is unrepairable and breaks every build. A
// committed allowlist in `test_kit_facade.py` pins the 37 against the real pinned surface so a
// typo cannot land green. All 37 render with just the App-root `HeroUINativeProvider` — its
// source mounts the PortalHost and ToastProvider, so the overlays (BottomSheet/Dialog/Popover/
// Menu/Toast) need no extra host wiring.
//
// The codegen agent MAY use these (owner call, 2026-08-03: release the whole kit, harden the
// DesignAgent against invented surface rather than gate — TODOS #43). It does NOT read this
// file: `read_key_files` skips the `ui/` dir, and `kit_reference.py` injects the curated
// `kit_facade_cheatsheet.md` (usage + compound structure + the imperative Toast hook) into the
// RNDev/RepairAgent prompt instead — the source lives in node_modules, not here, so a cheatsheet
// is the only thing to show. `test_kit_facade.py` pins that cheatsheet to document exactly these
// exports.
//
// One invariant remains — do not break it: the six components the frozen barrel already wraps
// with policy are NOT re-exported here. A raw `Button`/`TextField` beside the policy wrapper is a
// footgun (no haptics, no variant map, no theming); the frozen wrapper stays the single way to
// reach those, and the drift test fails if a consumed-and-wrapped name leaks into this list.

// Inputs & forms
export { Checkbox } from 'heroui-native';
export { Radio } from 'heroui-native';
export { RadioGroup } from 'heroui-native';
export { Switch } from 'heroui-native';
export { Slider } from 'heroui-native';
export { Select } from 'heroui-native';
export { SearchField } from 'heroui-native';
export { TextArea } from 'heroui-native';
export { InputGroup } from 'heroui-native';
export { InputOTP } from 'heroui-native';
export { ControlField } from 'heroui-native';
export { Label } from 'heroui-native';
export { FieldError } from 'heroui-native';
export { Description } from 'heroui-native';

// Overlays & navigation
export { BottomSheet } from 'heroui-native';
export { Dialog } from 'heroui-native';
export { Popover } from 'heroui-native';
export { Menu } from 'heroui-native';
export { SubMenu } from 'heroui-native';
export { Tabs } from 'heroui-native';
export { Accordion } from 'heroui-native';

// Content & display
export { Avatar } from 'heroui-native';
export { Alert } from 'heroui-native';
export { Toast } from 'heroui-native';
export { ListGroup } from 'heroui-native';
export { TagGroup } from 'heroui-native';
export { Typography } from 'heroui-native';
export { Separator } from 'heroui-native';

// Feedback
export { Skeleton } from 'heroui-native';
export { SkeletonGroup } from 'heroui-native';

// Surfaces & primitives
export { Surface } from 'heroui-native';
export { GlassView } from 'heroui-native';
export { ThemeBackground } from 'heroui-native';
export { ScrollShadow } from 'heroui-native';
export { PressableFeedback } from 'heroui-native';
export { CloseButton } from 'heroui-native';
export { LinkButton } from 'heroui-native';

// Hooks & utilities (not components). Toast is imperative-only — its usage is `useToast().toast
// .show(...)`, so the hook must be reachable from the barrel, because a screen may NOT import
// `heroui-native` directly (RNDEV_SYSTEM_PROMPT policy). test_kit_facade.py pins this exact set.
export { useToast } from 'heroui-native';
