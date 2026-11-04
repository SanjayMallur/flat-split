import React from 'react';
import { Image, ImageProps, ImageStyle } from 'expo-image';
import { View, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, IconName, KitIcon } from './Icon';

/**
 * FROZEN. Thin wrapper over expo-image with sensible defaults (caching, fade-in),
 * a `placeholder` shown until the image resolves, and a fallback that replaces a
 * broken or absent image with a tinted surface + icon instead of a blank hole.
 *
 * `uri` is nullable on purpose. A generated screen binds it straight to an API
 * field (`<Img uri={item.imageUrl} />`) and those are routinely optional; a
 * required `string` would fail `tsc` at exactly the call site the missing-image
 * fallback exists to serve.
 *
 * Deliberately sets NO default `aspectRatio`: this serves both hero images and
 * ListItem thumbnails, and a global default breaks the latter. Callers size it
 * through `style`; the fallback renders at that same size.
 */
export function Img({
  uri,
  style,
  contentFit = 'cover',
  placeholder,
  fallbackIcon,
  accessibilityLabel,
}: {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill';
  /** Blurhash/thumbhash string or source shown until the image resolves. */
  placeholder?: ImageProps['placeholder'];
  /** Glyph for the broken-image fallback. */
  fallbackIcon?: IconName;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  // A refetch can hand the same mounted cell a different image, so the failure
  // has to be cleared when `uri` changes rather than latched for the life of the
  // component. Keying alone isn't enough: a list that goes A -> B -> A would find
  // the stale `failedUri === 'A'` still matching and never retry a url that may
  // well load now.
  //
  // Held in STATE, not a ref: React's rule is that render reads no mutable ref,
  // and a ref shared across a concurrent render that gets abandoned would report
  // a uri change that never committed. Storing the rendered uri as state is the
  // documented shape for deriving state from a changed prop, and it resolves on
  // this pass rather than a frame late.
  const [failedUri, setFailedUri] = React.useState<string | null>(null);
  const [renderedUri, setRenderedUri] = React.useState(uri);
  if (renderedUri !== uri) {
    setRenderedUri(uri);
    setFailedUri(null);
  }
  const failed = renderedUri === uri && failedUri === uri;

  if (!uri || failed) {
    return (
      <View
        // Only a caller-supplied label makes this a screen-reader stop. A
        // decorative thumbnail with a dead url should stay silent, not announce
        // itself once per row down a 50-row list.
        accessible={accessibilityLabel ? true : undefined}
        accessibilityRole={accessibilityLabel ? 'image' : undefined}
        accessibilityLabel={accessibilityLabel}
        // The cast is unchecked on purpose: the fallback needs the box half of
        // `style` (size, radius, margin) and RN drops the image-only keys
        // (`resizeMode`, `tintColor`, `overlayColor`) on a View. Narrowing the
        // public prop to ViewStyle would break callers that legitimately pass them.
        style={[styles.fallback, { backgroundColor: t.palette.surfaceAlt }, style as StyleProp<ViewStyle>]}
      >
        {fallbackIcon ? (
          <Icon name={fallbackIcon} size={22} color={t.palette.textMuted} />
        ) : (
          <KitIcon name="image" size={22} color={t.palette.textMuted} />
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      // Without this expo-image keeps showing the PREVIOUS image while the new
      // one loads — a scrolled list row would wear the wrong record's photo
      // instead of the placeholder this component advertises.
      recyclingKey={uri}
      style={style}
      contentFit={contentFit}
      placeholder={placeholder}
      placeholderContentFit={contentFit}
      transition={200}
      cachePolicy="memory-disk"
      // expo-image defaults `accessible` to false, so a label alone leaves the
      // image invisible to VoiceOver — and the fallback branch would then be the
      // only reachable one, which is backwards.
      accessible={accessibilityLabel ? true : undefined}
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailedUri(uri)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
