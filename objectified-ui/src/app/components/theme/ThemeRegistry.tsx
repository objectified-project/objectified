'use client';

import * as React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Create a theme that automatically respects system preference
const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: true,
    dark: true,
  },
  typography: {
    fontFamily: 'var(--font-inter)',
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

