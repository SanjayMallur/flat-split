import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef, type Theme as NavigationTheme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { HeroUINativeProvider } from 'heroui-native';
import { Uniwind } from 'uniwind';
import { queryClient } from '@/lib/queryClient';
import { theme } from '@/theme/tokens';
import { activeIconFont } from '@/components/ui/Icon';
import { activeTextFonts } from '@/theme/fonts';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppProviders } from '@/providers/AppProviders';
import { AppNavigator } from '@/navigation/AppNavigator';
import { tabs, stackScreens } from '@/navigation/routes';

/**
 * FROZEN app shell. RNDev never edits this — it wires screens through
 * src/navigation/routes.tsx and adds app-specific providers via
 * src/providers/AppProviders.tsx. Provider order: gestures → safe area → data →
 * theme → error boundary → app providers → navigation.
 */

/**
 * Pin the colour scheme at module scope, BEFORE the first render.
 *
 * `app.json`'s `userInterfaceStyle` is a NATIVE-only pin — Expo Web never applies it. Left
 * alone, uniwind picks the root `.light`/`.dark` class from `Appearance.getColorScheme()`,
 * which on web is just `prefers-color-scheme`. So on a dark-mode host the heroui CSS
 * variables render DARK while `theme.generated.ts` (a static object, it cannot follow)
 * keeps painting LIGHT: black inputs and invisible ghost labels on a white canvas.
 *
 * NORMALIZE, never try/catch. `setTheme` throws on an unregistered name, and catching that
 * to fall through to the OS default re-creates the exact bug this fixes. `'light'`/`'dark'`
 * are always registered, so the ternary can never throw.
 *
 * The warn below is unreachable through `tsc` — `mode` is typed `'light' | 'dark'`. It is a
 * runtime backstop for the fact that `theme.generated.ts` is MACHINE-written per project:
 * a bad emit reaches this file as bytes, and without the log the app would just render in
 * light silently and the theming bug would be invisible.
 */
const pinnedTheme = theme.mode === 'dark' ? 'dark' : 'light';
if (theme.mode !== pinnedTheme) {
  console.warn(`[theme] unrecognised mode ${JSON.stringify(theme.mode)}; pinning '${pinnedTheme}'.`);
}
Uniwind.setTheme(pinnedTheme);

/**
 * Safe-area insets are 0 on web: there is no notch to measure. The kit reserves its
 * status-bar band from `insets.top` and its tab-bar clearance from `insets.bottom`, so a
 * web build renders a header flush with the top of the frame and a tab bar under the home
 * indicator — nothing like the same app on device.
 *
 * `SafeAreaProvider initialMetrics` does NOT fix this: `NativeSafeAreaProvider.web.tsx`
 * probes `env(safe-area-inset-*)` off a real DOM node and calls `onInsetsChange`
 * synchronously on mount, and `env()` is 0 in a desktop iframe — so the initial metrics are
 * overwritten a tick later. An explicit context provider mounted INSIDE `SafeAreaProvider`
 * is nearer than the one the provider itself renders, so `useSafeAreaInsets()` reads it and
 * the measurement path is never fought. Native takes the untouched provider.
 */
const WEB_SAFE_AREA_INSETS = { top: 47, bottom: 34, left: 0, right: 0 } as const;

function AppSafeAreaProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') {
    return <SafeAreaProvider>{children}</SafeAreaProvider>;
  }
  return (
    <SafeAreaProvider>
      <SafeAreaInsetsContext.Provider value={WEB_SAFE_AREA_INSETS}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </SafeAreaProvider>
  );
}

/**
 * React Navigation paints the scene background and card colours from its OWN theme, which
 * no CSS variable and no design token reaches. Mounting <NavigationContainer> with no
 * `theme` prop left a dark app sitting on RN Nav's default LIGHT surfaces — on device that
 * showed up as a white tab bar under a fully dark app, which reads as deliberate rather
 * than broken. Deriving it from the generated tokens is what closes that.
 */
const navigationTheme: NavigationTheme = (() => {
  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.palette.primary,
      background: theme.palette.bg,
      card: theme.palette.surface,
      text: theme.palette.text,
      border: theme.palette.border,
      notification: theme.palette.danger,
    },
  };
})();

/**
 * FROZEN. React Navigation's default swallows an unroutable action in production.
 *
 * `BaseNavigationContainer`'s `defaultOnUnhandledAction` opens with
 * `if (process.env.NODE_ENV === 'production') { return; }` — so a `navigate()` naming a
 * screen the navigator cannot resolve is a silent no-op in every shipped build. Measured on
 * the Wander recipe app (2026-09-13): `SignInScreen` called `navigation.navigate('Home')`
 * after a SUCCESSFUL login, but `Home` is a tab inside the `Tabs` navigator rather than a
 * root-stack route, and `navigate` searches the current navigator then its PARENTS — never
 * down into a sibling navigator's children. Six logins succeeded at the backend (six session
 * rows), the token was set, and the screen never moved. The owner tried twice, made a second
 * account, tried twice more. Nothing anywhere reported anything.
 *
 * So the app says it out loud instead. This does NOT throw: a dead button is bad, and
 * crashing the app on top of it is worse. `console.error` reaches the Metro log, the web
 * preview's console, and anything reading a generated app's output later.
 *
 * NOT the enforcement point, deliberately. The frontend smoke listens for `pageerror`
 * (uncaught throws) and not for console output, and widening it to fail on any console error
 * would inherit every React key warning and deprecation notice as a gate failure. The
 * deterministic check in `integration_validator.validate_mobile_kit_discipline` is what
 * FAILS a build for this class; this is what makes the cases it cannot see static — a
 * computed route name, a param-carrying target — visible to a human and to a log reader.
 */
function reportUnhandledNavigation(action: Readonly<{ type: string; payload?: object }>): void {
  const name = (action.payload as { name?: string } | undefined)?.name;
  console.error(
    `[naapy] Navigation action '${action.type}'` +
      (name ? ` to '${name}'` : '') +
      ' was not handled by any navigator, so nothing happened. ' +
      (name
        ? `Is '${name}' a TAB? A tab is reached through its stack screen (navigate('Tabs', ` +
          `{ screen: '${name}' })), not by its own name from the root stack.`
        : 'The action carried no screen name.'),
  );
}

/**
 * FROZEN. The screen check's handle, and only the screen check's (PLAN-follow-up-empty-plan-fixes
 * L2). Published when the page that loaded this bundle sets `screenCheck` in
 * `window.__NAAPY_CONFIG__`, which only the build's own check server does: the preview, a share
 * link and every export never set it, so for them this is one ref nothing reads.
 *
 * Before an app ships, the check opens every registered screen in a headless browser and fails
 * the build on one that crashes. The web build has no URL per screen (no `linking`, and the
 * preview is a srcdoc iframe), so it navigates through this ref, by the names the registry
 * exports. `ErrorBoundary` records what it catches into `crashes`: a caught render crash is not
 * an uncaught error, so a browser listening for those never sees the crash a user would.
 */
const navigationRef = createNavigationContainerRef();

function publishScreenCheckHandle(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  // @ts-ignore
  if (window.__NAAPY_CONFIG__?.screenCheck !== true) return;
  // @ts-ignore
  window.__naapyScreens = {
    ref: navigationRef,
    tabs: tabs.map((tab) => ({
      name: String(tab.name),
      screens: (tab.screens ?? []).map((screen) => String(screen.name)),
    })),
    stack: stackScreens.map((screen) => String(screen.name)),
    crashes: [],
  };
}
publishScreenCheckHandle();

export default function App() {
  // Icons render as tofu boxes if the glyph font arrives after first paint (worst on the
  // exported web preview). Block the first frame on the font; if it fails to load, render
  // anyway — the frontend gate flags the failure.
  //
  // `activeIconFont` follows the theme's chosen family rather than being hardcoded to
  // Ionicons: widening the family without moving the preload with it reopens the tofu bug
  // for every app that picks a different one.
  //
  // The glyph font AND this theme's text faces. Both are BUNDLED assets, so the objection
  // that cut the first text loader — `useFonts` has no timeout, and a blocked domain leaves
  // the app blank — does not apply: there is no domain. `activeTextFonts` is only the faces
  // this theme names — three for the default, which names Inter — and each already carries
  // its own weight, so no weight is left to the platform to synthesise. Only a theme naming
  // no family at all loads none. See src/theme/fonts.ts.
  const [fontsLoaded, fontsError] = useFonts({ ...activeTextFonts, ...activeIconFont });
  if (!fontsLoaded && !fontsError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppSafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <HeroUINativeProvider>
            <ThemeProvider>
              <ErrorBoundary>
                <AppProviders>
                  <NavigationContainer
                    ref={navigationRef}
                    theme={navigationTheme}
                    onUnhandledAction={reportUnhandledNavigation}
                  >
                    <AppNavigator />
                  </NavigationContainer>
                </AppProviders>
                {/*
                  Derived from the theme, never "auto". `auto` reads the OS colour scheme
                  while AppHeader paints itself from the tokens; the moment those two
                  disagree the status-bar content goes dark-on-dark. Observed on device.
                */}
                <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
              </ErrorBoundary>
            </ThemeProvider>
          </HeroUINativeProvider>
        </QueryClientProvider>
      </AppSafeAreaProvider>
    </GestureHandlerRootView>
  );
}
