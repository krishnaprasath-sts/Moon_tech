"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'moontech-theme';
const THEME_CHANGE_EVENT = 'moontech-theme-change';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

// Used when storage is unavailable (e.g. blocked by the browser)
let fallbackTheme: Theme | null = null;

function getStoredTheme(): Theme {
  if (fallbackTheme) return fallbackTheme;
  try {
    // Default to dark mode for fintech elegance
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

const getServerTheme = (): Theme => 'dark';

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(t);
  root.style.colorScheme = t;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useSyncExternalStore(subscribe, getStoredTheme, getServerTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
      fallbackTheme = null;
    } catch {
      fallbackTheme = t;
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
