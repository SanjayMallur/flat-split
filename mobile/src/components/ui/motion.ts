import React from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * FROZEN. The three animations a generated app is allowed to have, as kit defaults rather
 * than something a prompt has to ask for.
 *
 * WHY THESE THREE AND NOT MORE. 116 screen files across 36 Rork-exported apps were read for
 * exactly this question (RESEARCH-beautiful-mobile-frontends §9.25). Their entire motion
 * vocabulary is a press scale (11 files), a slide-in (10) and a fade (6), all on React
 * Native's legacy `Animated`. Zero files use `useSharedValue`/`useAnimatedStyle`; zero use a
 * shared-element transition. We ship Reanimated to every generated app and used none of the
 * three, which is the whole of the "it feels dead" gap — not the exotic stuff.
 *
 * LEGACY `Animated`, DELIBERATELY. Reanimated is installed and would work, but every one of
 * these runs on the native driver as plain transform/opacity, which is the case `Animated`
 * already handles at 60fps without a worklet. Using it keeps these hooks callable from a
 * frozen component with no extra provider and no babel plugin ordering to get wrong.
 *
 * Durations are DESIGN.md §Motion's, not invented here.
 */

/** DESIGN.md §Motion: micro 100ms · short 150-250ms · medium 250-400ms. */
export const DURATION = { micro: 100, short: 200, medium: 320 } as const;

/**
 * True when the OS asks for reduced motion. DESIGN.md §Motion requires respecting it, and
 * every hook below degrades to "no animation, final value" rather than a shorter one — a
 * user who asked for no motion did not ask for quick motion.
 *
 * Subscribed, not read once: the setting can change while the app is open, and a cached
 * `false` would keep animating for the rest of the session.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * The press feel. Returns the handlers and the style to spread onto an `Animated.View`
 * inside a `Pressable`.
 *
 * A SCALE, not an opacity fade. `TouchableOpacity`'s dimming is the single loudest "this is
 * a React Native app built quickly" tell, and it reads especially badly on a photo: fading
 * an image to 80% looks like a loading state, where a 2% scale reads as the surface being
 * pushed. It is also what the corpus does — `transform: [{ scale: 0.98..0.99 }]` is the most
 * common interaction in it.
 */
export function usePressScale(to: number = 0.98) {
  const reduced = useReducedMotion();
  const scale = React.useRef(new Animated.Value(1)).current;
  const run = React.useCallback(
    (value: number) => {
      if (reduced) {
        scale.setValue(1);
        return;
      }
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }).start();
    },
    [reduced, scale],
  );
  return {
    style: { transform: [{ scale }] },
    onPressIn: () => run(to),
    onPressOut: () => run(1),
  };
}

/**
 * The arrival. A fade plus a small upward slide, run once on mount.
 *
 * `index` staggers a list so rows arrive in sequence instead of as one block. Capped at
 * `STAGGER_CAP` entries: an uncapped stagger means row 40 of a long list waits two seconds
 * for an animation nobody scrolled far enough to see, and on a recycled `FlatList` row the
 * index is the DATA index, so it would keep re-staggering as you scroll.
 */
const STAGGER_CAP = 6;
const STAGGER_MS = 45;

export function useEnterTransition(index: number = 0) {
  const reduced = useReducedMotion();
  const progress = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      // `short`, not `medium`, and MEASURED rather than chosen. A frame-by-frame read of a
      // shipped media app (JioHotstar, 2026-09-13) put every screen-level arrival at
      // 160-200ms: mean luma 70 -> 38 over nine frames on a push, 160ms on a pop. `medium`
      // (320ms) was picked with no evidence and is nearly twice that.
      duration: DURATION.short,
      delay: Math.min(index, STAGGER_CAP) * STAGGER_MS,
      // DESIGN.md: enter is ease-OUT — fast first, settling, which reads as arriving
      // rather than being pushed.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduced]);

  return {
    style: {
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
        },
      ],
    },
  };
}

/**
 * The floating-panel transition: the same fade + slide, but DRIVEN by a boolean rather than
 * run once, so a panel can come and go. Used by `MapSurface` for its selected-point card.
 *
 * It never unmounts its content — the caller decides that. A hook cannot animate something
 * out that React has already removed, so an exit animation has to be the caller holding the
 * child mounted until `visible` has settled, which is why `SelectedCard` is rendered by
 * `MapSurface` rather than conditionally by the screen.
 */
export function useSlideIn(visible: boolean) {
  const reduced = useReducedMotion();
  const progress = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  React.useEffect(() => {
    if (reduced) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? DURATION.short : DURATION.micro,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, visible]);

  return {
    style: {
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
        },
      ],
    },
  };
}
