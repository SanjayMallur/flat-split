import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader } from './AppHeader';
import { KitIcon } from './Icon';
import { FAB, FAB_CLEARANCE } from './FAB';
import { useScreenBottomInset } from './useScreenBottomInset';
import type { IconName, KitIconName } from './Icon';
import { APP_NAME, NATIVE_HEADER } from '@/config/app';
import { stackScreens, tabs } from '@/navigation/routes';

/**
 * FROZEN. Standard screen frame: a top app bar, safe-area padding, optional
 * scroll, and an optional floating action button. Non-scroll screens (that own a
 * FlatList) pass `scroll={false}`.
 *
 * The app bar is ALWAYS shown. A top-level screen (no `onBack`) shows the app
 * name (APP_NAME) unless it passes its own `title`, giving every app a
 * WhatsApp-style app-name bar for free; a pushed screen (`onBack`) always shows a
 * back button, with or without a title. The AppHeader owns the status-bar/notch
 * inset so content never bleeds under it.
 *
 * The bottom safe-area inset is handled too: scroll content is padded to clear the
 * nav bar (and the FAB, when present), so a persistent bottom action
 * (delete/save/checkout) simply goes as the last element in `children` — never a
 * hand-pinned absolute bottom bar.
 *
 * That padding only exists on the scroll branch. A screen that owns its own
 * FlatList passes `scroll={false}`, and then this component reserves NOTHING at
 * the bottom — deliberately, because container padding would shrink the list's
 * viewport and leave a dead gutter instead of letting rows scroll under the nav
 * bar. Such a screen pads its own list with `useScreenBottomInset()` from
 * `@/components/ui` — see HomeScreen's `contentContainerStyle`.
 */
/**
 * Every route the navigator PUSHES: the root stack's screens, plus each tab's own stack.
 *
 * `tabs[].screens` is optional because the registry has two authors — compiled from the
 * Architect's plan, or written by RNDev when the plan predates that decision. An older
 * registry has no `screens` key and this collapses to the root stack, which is what it
 * always was.
 *
 * LAZY, ON FIRST RENDER — NEVER AT MODULE SCOPE. This looks like it should be a top-level
 * constant, and it was, for one commit, and every app built with it white-screened at
 * launch: `ReferenceError: Cannot access 's' before initialization`. The import graph is a
 * CYCLE — `routes.tsx` imports every screen, every screen imports this kit, and this file
 * imports `routes.tsx` — so while `routes.tsx` is still loading its screens, this module's
 * top level runs and asks for `stackScreens`, which does not exist yet. React never mounts,
 * nothing is logged to the console, and `tsc` is perfectly happy. By the time any screen
 * RENDERS, every module has finished loading, which is why reading it here is safe and
 * reading it one level up is not. `test_the_kit_never_reads_the_registry_at_module_scope`
 * keeps it that way.
 */
let pushedRouteNames: ReadonlySet<string> | null = null;
function isPushedRoute(name: string): boolean {
  pushedRouteNames ??= new Set<string>([
    ...stackScreens.map((s) => String(s.name)),
    ...tabs.flatMap((t) => (t.screens ?? []).map((s) => String(s.name))),
  ]);
  return pushedRouteNames.has(name);
}

export function Screen({
  children,
  title,
  onBack,
  headerRight,
  scroll = true,
  padded = true,
  header = true,
  fab,
}: {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /**
   * `false` drops the app bar AND the top padding, so the first child runs to the very top
   * edge and under the status bar. The one layout this is for is a full-bleed `HeroHeader`:
   * with the bar on you get a grey strip, then a photo, which is the composition the hero
   * exists to replace. 21 of 116 screens in the Rork corpus float their header over the
   * content this way (RESEARCH-beautiful-mobile-frontends §9.25).
   *
   * THE CHILD THEN OWNS THE TOP INSET, and only `HeroHeader` does. Passing `false` around an
   * ordinary column puts the first line of text under the notch — which is precisely the
   * failure `AppHeader` was made to own, so the default stays `true` and this is opt-in per
   * screen rather than a mode anything inherits.
   */
  header?: boolean;
  fab?: { icon?: IconName; kitIcon?: KitIconName; onPress: () => void; label?: string };
}) {
  const t = useTheme();
  const bottomInset = useScreenBottomInset();
  const pad = padded ? t.spacing.lg : 0;

  // A non-empty title labels the screen; otherwise a top-level screen falls back
  // to the app name and a pushed screen shows a bare back bar. The bar is always
  // rendered, so it always owns the top inset.
  const barTitle = title && title.trim() ? title : onBack ? '' : APP_NAME;

  const scrollBottom = pad + bottomInset + (fab ? FAB_CLEARANCE : 0);

  // Which header is drawing THIS screen. A pushed screen is one the routes registry PUSHES,
  // which is exactly the set `AppNavigator` gives the platform header to — read from the same
  // source rather than inferred from the navigator's internals, so the two can never disagree
  // about a screen.
  //
  // BOTH PLACES A SCREEN CAN BE PUSHED FROM, and missing the second one is a shipped defect
  // worth naming: when navigation became a compiled decision, a tab gained its OWN stack
  // (`tabs[].screens`) and this test still read `stackScreens` alone. `AppNavigator` drew the
  // platform header for those screens and this said "not pushed", so the kit drew its header
  // too — two toolbars and two back chevrons on every detail screen, with different titles.
  // Caught on an S23, by a human, after `tsc`, the kit-discipline check, the fidelity judge
  // and a web preview all passed: the web preview showed it as well and nobody read it as
  // wrong. A set, not two `.some()` calls, because a screen reachable from two tabs appears
  // in both. Read LAZILY — see `isPushedRoute` for why that is not optional.
  //
  // READ FROM THE CONTEXT, NEVER `useRoute()`. `Screen` is rendered OUTSIDE the navigator by
  // the frozen `auth-gate` capability — `AppProviders` sits above `AppNavigator` in the shell,
  // and the gate renders `AuthGateScreen` (and its own `<Screen>` loading state) there. Both
  // `useRoute` and `useNavigation` THROW outside a navigator, so the moment this component
  // started asking which header draws it, every generated app with a sign-in wall white-screened
  // at launch with "Couldn't find a route object." It typechecks, passes the contract, import,
  // kit-discipline and backend gates, and dies on the first frame; only launching the app finds
  // it. `NATIVE_HEADER` does not guard it either — the hook runs before the flag is consulted.
  // No route means no navigator, which means the platform header cannot be drawing this screen.
  const route = React.useContext(NavigationRouteContext);
  const platformHeader =
    header && NATIVE_HEADER && !!route && isPushedRoute(route.name as string);

  // `header={false}` has to silence the PLATFORM header too, not just ours. A pushed screen
  // that asks for no bar and gets React Navigation's instead is the same defect with a
  // different owner — an opaque strip across the top of the photo.
  useNativeHeader({ enabled: platformHeader, title, onBack, headerRight });
  useHiddenNativeHeader(header === false && NATIVE_HEADER && !!route);

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ padding: pad, paddingBottom: scrollBottom }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: pad }}>{children}</View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: t.palette.bg }]}>
      {!header || platformHeader ? null : (
        <AppHeader title={barTitle} onBack={onBack} right={headerRight} />
      )}
      {body}
      {fab ? <FAB icon={fab.icon} kitIcon={fab.kitIcon} onPress={fab.onPress} label={fab.label} /> : null}
    </View>
  );
}

/** Hide the platform header for a `header={false}` screen that the native stack is drawing.
 *
 * A separate hook from `useNativeHeader` rather than another branch in it, because the two
 * want opposite things from the same `setOptions` call and a single hook would have to encode
 * "set these, unless, in which case unset that". `headerShown` is the whole of it. */
function useHiddenNativeHeader(hide: boolean) {
  const navigation = React.useContext(NavigationContext);
  React.useLayoutEffect(() => {
    if (!hide || !navigation) return;
    navigation.setOptions({ headerShown: false });
  }, [hide, navigation]);
}

/** Push the screen's header props onto the PLATFORM header, when that is what is rendering.
 *
 * A hook rather than a branch inline, because the context read and `useLayoutEffect` cannot sit
 * behind an `if`. On a top-level screen it is a no-op with stable dependencies, so the
 * `AppHeader` path pays nothing.
 *
 * `NavigationContext` rather than `useNavigation()` for the reason given on the route read
 * above: outside a navigator the hook throws and the auth gate renders this component there.
 * An absent navigator disables the effect; nothing else changes inside one.
 *
 * A screen that states no `title` is left alone rather than blanked: the registry already gave
 * the route a title, and overwriting it with `undefined` would empty a bar the navigator had
 * filled correctly.
 *
 * `onBack` is honoured rather than ignored. The platform already draws a back control here, but
 * a screen passing `onBack` is asking for its OWN behaviour on it — a confirm-before-discard on
 * a dirty form is the case that matters — and silently dropping it loses data rather than
 * looking wrong.
 */
function useNativeHeader({
  enabled,
  title,
  onBack,
  headerRight,
}: {
  enabled: boolean;
  title?: string;
  onBack?: () => void;
  headerRight?: React.ReactNode;
}) {
  const t = useTheme();
  const navigation = React.useContext(NavigationContext);
  React.useLayoutEffect(() => {
    if (!enabled || !navigation) return;
    navigation.setOptions({
      ...(title && title.trim() ? { title } : {}),
      headerRight: headerRight ? () => <>{headerRight}</> : undefined,
      headerLeft: onBack
        ? () => (
            <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
              <KitIcon name="back" size={26} color={t.palette.text} />
            </Pressable>
          )
        : undefined,
    });
  }, [enabled, navigation, title, onBack, headerRight, t.palette.text]);
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
