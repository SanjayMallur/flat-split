import React from 'react';
import { Platform, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, KitIcon } from '@/components/ui/Icon';
import { DURATION, useReducedMotion } from '@/components/ui/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/theme/tokens';
import { cappedTextScaling } from '@/theme/textScaling';
import { NATIVE_HEADER } from '@/config/app';
import { tabs, stackScreens, RootStackParamList } from './routes';
import type { TabRoute } from './routes';

/**
 * FROZEN. Builds the navigation tree from the routes registry: a bottom-tab
 * navigator (from `tabs`) wrapped in a native stack (for `stackScreens`).
 *
 * Under `NATIVE_HEADER`, PUSHED screens get the platform header and top-level tab
 * screens keep `AppHeader` — see `@/config/app` for why the split falls there. The
 * tab navigator's own header stays off either way; it is a plain JS bar with none
 * of the platform behaviour, so turning it on would cost the 28px title and buy
 * nothing.
 */
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();
const TabStack = createNativeStackNavigator();

/**
 * One tab's OWN back stack: the tab's screen, plus everything the plan pushed inside it.
 *
 * This is the shape an Android engineer expects — a `NavHost` per bottom-nav destination —
 * and what `bluesky-social/social-app` ships on native. The tab bar stays visible while you
 * are drilled in, and Back returns INTO that tab instead of unwinding the whole app.
 *
 * `screens` is optional because the registry has two authors. When the Architect's plan
 * decided the navigation, `routes.tsx` is COMPILED and carries it; when the plan predates
 * that decision the compiler stands down and RNDev writes the file as before, with no
 * `screens` key. An empty stack renders exactly what the old shape did, so both compile and
 * both run.
 *
 * Built ONCE at module scope, never inside render: a component identity created per render
 * remounts the whole tab on every parent re-render, losing its scroll position and its
 * navigation state — the bug this shape exists to avoid.
 */
function makeTabStack(tab: TabRoute) {
  const pushed = tab.screens ?? [];
  return function TabStackNavigator() {
    const t = useTheme();
    return (
      <TabStack.Navigator
        screenOptions={{
          ...(NATIVE_HEADER ? nativeHeaderOptions(t) : ({ headerShown: false } as const)),
          contentStyle: { backgroundColor: t.palette.bg },
        }}
      >
        {/* The tab's own screen keeps the app header, exactly as a top-level screen did
            before it had a stack under it. Only the screens PUSHED on top of it get the
            platform header — the same split `NATIVE_HEADER` already draws. */}
        <TabStack.Screen
          name={tab.name}
          component={tab.component}
          options={{ headerShown: false }}
        />
        {pushed.map((s) => (
          <TabStack.Screen
            key={s.name}
            name={s.name}
            component={s.component}
            options={{ title: s.title }}
          />
        ))}
      </TabStack.Navigator>
    );
  };
}

/** Resolved once, so a tab's stack component is stable for the life of the app. */
const TAB_STACKS: ReadonlyArray<{ tab: TabRoute; Screen: React.ComponentType }> = tabs.map(
  (tab) => ({ tab, Screen: makeTabStack(tab) })
);

/** The platform header, wearing the app's own palette and typeface.
 *
 * Both are stated because a native header falls back to the SYSTEM font otherwise, and an
 * app whose screens render Playfair under an SF Pro title reads as a broken screen rather
 * than a styled one — the same failure the tab bar's own comment below records. */
function nativeHeaderOptions(t: Theme) {
  return {
    headerShown: true,
    headerStyle: { backgroundColor: t.palette.surface },
    headerTintColor: t.palette.text,
    headerTitleStyle: {
      color: t.palette.text,
      fontSize: t.typography.h3.fontSize,
      fontFamily: t.typography.h3.fontFamily,
    },
    // iOS ONLY, and stated rather than assumed: it puts the previous screen's name beside
    // the chevron. Android has no such idiom, and passing it there is silently ignored —
    // which is how the large-title promise went unnoticed until a device run.
    ...(Platform.OS === 'ios' ? { headerBackTitle: 'Back' } : {}),
    headerShadowVisible: true,
  } as const;
}

function TabsNavigator() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.palette.primary,
        tabBarInactiveTintColor: t.palette.textMuted,
        // The tint alone follows the theme; the BAR comes from React Navigation's own
        // theme. Setting only the tint is what produced a white tab bar with a themed
        // icon on device — half-themed, which looks intentional and therefore worse than
        // untouched. Match AppHeader, which paints itself `surface`.
        tabBarStyle: { backgroundColor: t.palette.surface, borderTopColor: t.palette.border },
        // DT15: the tab bar is fixed-height, so an uncapped accessibility multiplier
        // overflows it rather than growing it — and a condensed display face reaches that
        // point far sooner than the system font does.
        //
        // Rendered rather than styled, because `maxFontSizeMultiplier` is a Text PROP and
        // `tabBarLabelStyle` only takes a TextStyle. The size and weight match React
        // Navigation's below-icon uikit label, and tint plus one-line truncation are
        // preserved — but this does NOT reproduce its adaptive beside-icon treatment on wide
        // screens, where the default would place the label next to the icon. A phone-first
        // generator never hits that; a tablet layout would want it back.
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            // The theme's face, via `label` — a bare weight with no family renders the tab
            // bar in the system font while everything above it renders the approved
            // typeface, which reads as a broken screen rather than a deliberate one. `label`
            // is the 600 variant, so it carries a real face and needs no synthesis.
            style={{
              color,
              fontSize: 10,
              // Web only: react-native-web lets a flex child shrink (Yoga on device does not),
              // so the 48px tab item squeezed this one-line, overflow-hidden label from 12px to
              // 10px and cut every descender — "Todav", "Proaress" in every web preview.
              flexShrink: 0,
              fontWeight: t.typography.label.fontWeight,
              fontFamily: t.typography.label.fontFamily,
              textAlign: 'center',
            }}
            {...cappedTextScaling}
          >
            {children}
          </Text>
        ),
        tabBarIcon: ({ color, size }) => {
          const entry = tabs.find((tb) => tb.name === route.name);
          // The FALLBACK is the kit's own glyph: `ellipse-outline` is an Ionicons name and
          // would not compile once `iconSet` is themed away from the default.
          return entry?.icon ? (
            <Icon name={entry.icon} size={size} color={color} />
          ) : (
            <KitIcon name="placeholder" size={size} color={color} />
          );
        },
      })}
    >
      {TAB_STACKS.map(({ tab, Screen }) => (
        <Tab.Screen key={tab.name} name={tab.name} component={Screen} options={{ title: tab.title }} />
      ))}
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const pushed = NATIVE_HEADER ? nativeHeaderOptions(t) : ({ headerShown: false } as const);
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // STATED, not left to the platform default. Nothing here configured a transition, so
        // every generated app got React Navigation's stock push — and the screen change is the
        // most visible motion in an app, far more than the three widget animations `motion.ts`
        // owns. That gap was invisible to the 116-file corpus read those three came from:
        // `rork-layouts/fetch.py` selects screen and card files, and a screen transition is
        // declared in the NAVIGATOR, so the corpus could not contain one.
        //
        // `slide_from_bottom`, and the choice is about the CLOSE. `fade_from_bottom` shipped
        // here first and a device run rejected it: the open looked right and the back read as
        // "a jump or a splash". Reading react-native-screens' own Android resources
        // (`utils/FragmentTransactionKt.kt`, `setCustomAnimations(enter, exit)`) says why —
        // the preset is asymmetric by construction, and the asymmetry is only on the close:
        //
        //   fade_from_bottom  open : incoming alpha 0->1 + translateY 8%->0   outgoing STATIC
        //                     close: incoming STATIC        outgoing alpha 1->0 + translateY 8%
        //   slide_from_bottom open : incoming translateY 100%->0              outgoing STATIC
        //                     close: incoming STATIC        outgoing translateY 0->100%
        //
        // Both leave the incoming screen static on the close, which is CORRECT for a modal —
        // a sheet should travel, not the page under it. The difference is what the outgoing
        // screen does. `fade_from_bottom` FADES it out while moving it 8%, so mid-transition
        // it is semi-transparent over whatever is beneath; measured on device that produced a
        // single pure-white frame and no perceptible motion. `slide_from_bottom` translates it
        // the full screen height at full opacity — a real dismissal, and never transparent, so
        // there is no gap for a background to show through.
        animation: reduced ? 'none' : 'slide_from_bottom',
        // iOS ONLY — `@platform ios` in react-native-screens' own types, which is where this
        // was CHECKED rather than assumed (the first version of this comment said Android, and
        // said it backwards). It earns its place anyway: the iOS default for
        // `fade_from_bottom` is 500ms, two and a half times anything measured.
        //
        // So ANDROID takes this transition at the OS's own duration, not `short`. The shape
        // changes on both platforms; the timing only lands on iOS. Android has no native-stack
        // equivalent to reach for — that duration comes from the platform, not from a prop
        // (`config_mediumAnimTime`, ~400ms). `slide_from_bottom` is in the set the iOS prop
        // covers, alongside `fade_from_bottom`, `fade` and `simple_push` — `ios_from_right` is
        // NOT, so this would have become dead config had the close been fixed that way.
        animationDuration: DURATION.short,
        // The scene paints its own background so nothing can show through mid-transition.
        // `NavigationContainer` already carries `colors.background`, but that is React
        // Navigation's theme; the white frame the device run caught was BELOW it — the window,
        // which `app.json` never sets a `backgroundColor` for, so Expo leaves it white on a
        // dark app. `slide_from_bottom` closes the gap that exposed it and this closes the
        // gap itself, because one of them is a preset choice someone may revisit.
        contentStyle: { backgroundColor: t.palette.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      {stackScreens.map((s) => (
        <Stack.Screen
          key={s.name}
          name={s.name}
          component={s.component}
          // `presentation` is passed through rather than ignored: a route the plan marked a
          // MODAL is a root entry carrying the flag, so dropping it here would push a picker
          // as an ordinary page — declared as a modal, shipped as something else.
          options={{ ...pushed, title: s.title, ...(s.presentation ? { presentation: s.presentation } : {}) }}
        />
      ))}
    </Stack.Navigator>
  );
}
