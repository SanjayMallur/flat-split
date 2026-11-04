import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * FROZEN. Bottom space a screen must reserve so its last row clears the system
 * nav bar / home indicator. This file owns the rationale; other sites point here.
 *
 * Zero inside a bottom-tab screen. The tab bar is a flex sibling BELOW the scene
 * and already pads itself by the inset (`BottomTabBar` applies
 * `paddingBottom: insets.bottom`, and its height includes that inset), so the
 * scene's bottom edge is the TOP of the bar and nothing system-owned overlaps it.
 * The real inset outside the tab navigator, where the scene's bottom edge IS the
 * window's.
 *
 * Reads the context rather than calling `useBottomTabBarHeight()`, which THROWS
 * when there is no tab bar — a pushed stack screen is exactly that case. The
 * provider passes `0` for a top/side tab bar, which correctly falls through.
 *
 * Three shapes it reads wrong. The first two RETURN TOO LITTLE — content is
 * clipped under system chrome, not merely over-padded — so neither degrades
 * gracefully and both need the workaround named:
 *  - Content inside a `<Modal>`, or a sheet that is still in this React tree.
 *    The modal's native window covers the tab bar, but the context follows the
 *    REACT tree and still reports the bar, so this returns `0` where the answer
 *    is the window inset: a bottom-pinned Save sits under the home indicator.
 *    Use `useSafeAreaInsets().bottom` there. (A sheet mounted OUTSIDE the tab
 *    navigator gets `undefined` and is already correct — being portalled is not
 *    what breaks it, being in-tree is.)
 *  - A tab bar taken out of normal flow. `BottomTabBar` spreads `tabBarStyle`
 *    AFTER its own position style, so `position: 'absolute'` floats the bar over
 *    the scene and this would have to return the measured height instead of `0`;
 *    the last rows render behind the bar. The frozen `AppNavigator` sets no
 *    `tabBarStyle` and `test_kit_bottom_inset.py` fails if it ever does, but a
 *    screen can still reach the same state through `navigation.setOptions`, which
 *    is why the RNDev prompt forbids it.
 *  - A tab navigator nested inside a tab screen with a top/side inner bar. The
 *    inner provider shadows the outer with `0`, so this returns the window inset
 *    while the outer bottom bar is what the scene actually ends above. This one
 *    only over-pads.
 *
 * Kept `.tsx` despite having no JSX: `services/worker/kit_reference.py` globs
 * `*.tsx` to build the kit reference every RNDev/Repair prompt carries, so a
 * `.ts` rename would silently drop this hook from both.
 */
export function useScreenBottomInset(): number {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useContext(BottomTabBarHeightContext);
  return bottomTabBarHeight ? 0 : insets.bottom;
}
