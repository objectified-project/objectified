'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { Theme, themes, getThemeById, getDefaultTheme } from '../config/themes';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  availableThemes: Theme[];
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(getDefaultTheme());
  const [isSystemTheme, setIsSystemTheme] = useState(false);
  const mountedRef = useRef(false);
  const { setTheme: setNextTheme, resolvedTheme, theme: nextTheme } = useNextTheme();

  // Get the effective theme for system preference
  const getSystemPreferredTheme = useCallback(() => {
    const prefersDark = resolvedTheme === 'dark';
    return prefersDark ? getThemeById('dark') || getDefaultTheme() : getThemeById('light') || getDefaultTheme();
  }, [resolvedTheme]);

  // Apply theme to DOM
  const applyTheme = useCallback((theme: Theme, isSystem: boolean = false) => {
    const html = document.documentElement;
    const body = document.body;

    // Remove all theme classes from html and body
    themes.forEach(t => {
      html.classList.remove(t.cssClass);
      body.classList.remove(t.cssClass);
    });

    // For system theme, we apply the actual light/dark theme but mark it as system
    const effectiveTheme = isSystem ? getSystemPreferredTheme() : theme;

    // Set data-theme attribute for CSS targeting
    html.setAttribute('data-theme', effectiveTheme.id);
    body.setAttribute('data-theme', effectiveTheme.id);

    // Determine if this is a "dark" based theme (needs .dark class for Tailwind dark: variants)
    const darkThemes = ['dark', 'high-contrast', 'blueprint', 'solarized', 'nord', 'darcula'];
    const isDarkBased = darkThemes.includes(effectiveTheme.id);

    // Use next-themes to set the theme class (it will handle .dark class)
    if (isDarkBased) {
      setNextTheme('dark');
    } else {
      setNextTheme('light');
    }

    // Add new theme class to both html and body
    html.classList.add(effectiveTheme.cssClass);
    body.classList.add(effectiveTheme.cssClass);

    // Set CSS custom properties directly on html style
    html.style.setProperty('--background', effectiveTheme.colors.background);
    html.style.setProperty('--foreground', effectiveTheme.colors.foreground);

    // Force body background and color
    body.style.backgroundColor = effectiveTheme.colors.background;
    body.style.color = effectiveTheme.colors.foreground;
  }, [getSystemPreferredTheme, setNextTheme]);

  // Initialize theme from localStorage or system preference (only runs once on mount)
  useEffect(() => {
    if (mountedRef.current) return;

    mountedRef.current = true;
    // Use same storage key as next-themes: 'theme'
    const savedThemeId = localStorage.getItem('app-theme');
    const nextThemeSaved = localStorage.getItem('theme');

    // Check if next-themes is set to system or if no preference exists
    const shouldUseSystem = !nextThemeSaved || nextThemeSaved === 'system';

    if (savedThemeId === 'system' || shouldUseSystem) {
      // User chose to follow system
      const systemTheme = getThemeById('system');
      if (systemTheme) {
        setCurrentTheme(systemTheme);
        setIsSystemTheme(true);
        applyTheme(systemTheme, true);
      }
    } else if (savedThemeId) {
      const theme = getThemeById(savedThemeId);
      if (theme) {
        setCurrentTheme(theme);
        setIsSystemTheme(false);
        applyTheme(theme, false);
      }
    } else {
      // No saved preference - default to system
      const systemTheme = getThemeById('system') || getDefaultTheme();
      setCurrentTheme(systemTheme);
      setIsSystemTheme(true);
      applyTheme(systemTheme, true);
      localStorage.setItem('app-theme', 'system');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for resolved theme changes from next-themes
  useEffect(() => {
    if (!mountedRef.current) return;

    if (isSystemTheme && resolvedTheme) {
      const systemTheme = getThemeById('system');
      if (systemTheme) {
        applyTheme(systemTheme, true);
      }
    }
  }, [isSystemTheme, resolvedTheme, applyTheme]);

  // Sync with next-themes when it changes
  useEffect(() => {
    if (!mountedRef.current) return;

    // If next-themes is set to system, update our theme accordingly
    if (nextTheme === 'system' && !isSystemTheme) {
      const systemTheme = getThemeById('system');
      if (systemTheme) {
        setCurrentTheme(systemTheme);
        setIsSystemTheme(true);
        applyTheme(systemTheme, true);
        localStorage.setItem('app-theme', 'system');
      }
    }
  }, [nextTheme, isSystemTheme, applyTheme]);

  const setTheme = (themeId: string) => {
    const theme = getThemeById(themeId);
    if (theme) {
      const isSystem = themeId === 'system';
      setCurrentTheme(theme);
      setIsSystemTheme(isSystem);
      applyTheme(theme, isSystem);
      localStorage.setItem('app-theme', themeId);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes: themes, isSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

