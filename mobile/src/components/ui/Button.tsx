import React from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button as HButton, Spinner } from 'heroui-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, IconName, KitIcon, KitIconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

const heroVariant: Record<Variant, 'primary' | 'secondary' | 'danger' | 'ghost'> = {
  primary: 'primary',
  secondary: 'secondary',
  destructive: 'danger',
  ghost: 'ghost',
};

/** FROZEN. Primary action button with variants, loading state, and haptics. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  kitIcon,
  fullWidth = true,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** For the FROZEN kit's own buttons. A kit component cannot name a family glyph — the
   * literal would not compile once `iconSet` is themed away from the default. */
  kitIcon?: KitIconName;
  fullWidth?: boolean;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const fg: Record<Variant, string> = {
    primary: t.palette.primaryText,
    secondary: t.palette.text,
    destructive: t.palette.dangerText,
    ghost: t.palette.primary,
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  return (
    <HButton
      variant={heroVariant[variant]}
      isDisabled={isDisabled}
      onPress={handlePress}
      accessibilityRole="button"
      className={fullWidth ? 'self-stretch' : 'self-center'}
    >
      {loading ? (
        <Spinner size="sm" color={fg[variant]} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg[variant]} /> : null}
          {!icon && kitIcon ? <KitIcon name={kitIcon} size={18} color={fg[variant]} /> : null}
          <HButton.Label>{title}</HButton.Label>
        </>
      )}
    </HButton>
  );
}
