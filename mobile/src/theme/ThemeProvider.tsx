import React, { createContext, useContext } from 'react';
import { theme as defaultTheme, Theme } from './tokens';

/**
 * FROZEN. Exposes the design tokens through context so UI-kit components can read
 * them with `useTheme()`. Single palette today; swapping in a dark theme later is a
 * one-line change here.
 */
const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={defaultTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
