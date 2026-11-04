import React from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Card as HCard } from 'heroui-native';
import { usePressScale } from './motion';

/** FROZEN. Elevated surface container. Becomes pressable when `onPress` is given. */
export function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const press = usePressScale(0.99);
  const body = (
    <HCard className="p-4" style={style}>
      {children}
    </HCard>
  );
  if (onPress) {
    return (
      // A SCALE, not a fade. Dimming a card to 90% is `TouchableOpacity`'s default and the
      // single loudest "built quickly in React Native" tell — on a card carrying a photo it
      // reads as a loading state, where a 1% scale reads as the surface being pushed. It is
      // also what the corpus does (RESEARCH-beautiful-mobile-frontends §9.25): a press
      // transform is the most common interaction in it, in 11 of 116 files.
      <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
        <Animated.View style={press.style}>{body}</Animated.View>
      </Pressable>
    );
  }
  return body;
}
