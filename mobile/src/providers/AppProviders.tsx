import React from 'react';
import { AuthGate } from '@/providers/auth/AuthGate';
import { AuthProvider } from '@/providers/auth/AuthProvider';

/**
 * GENERATED seam — the one place RNDev adds app-specific providers (auth, cart, a
 * custom context, etc.). The frozen App.tsx renders this inside the data + theme
 * providers and around navigation, so anything added here can use React Query and
 * the theme, and sits above every screen.
 *
 * Default: pass-through. Keep the return below exactly as it is: built-in features
 * (sign-in) are wired into it. To add a provider, rename the parameter
 * ({ children: screens }) and above that return write
 * const children = <CartProvider>{screens}</CartProvider>;
 * Keep providers here instead of editing App.tsx (frozen).
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // >>> naapy-capabilities (managed provider stack — do not edit) >>>
  return (
    <AuthProvider>
      <AuthGate>
        {children}
      </AuthGate>
    </AuthProvider>
  );
  // <<< naapy-capabilities <<<
}
