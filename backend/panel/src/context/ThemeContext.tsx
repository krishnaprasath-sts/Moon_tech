import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'dark' | 'light';

/** Anything with a currentTarget, e.g. the click event of the toggle button */
type ToggleSource = { currentTarget?: EventTarget | null };

interface ThemeContextType {
  theme: Theme;
  /** Pass the click event so the new theme spreads out from the button that was pressed */
  toggleTheme: (source?: ToggleSource) => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'moon_tech_theme';
const REVEAL_MS = 550;
const FADE_MS = 350;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Centre of the pressed button, or the top-right corner (where the toggle sits) */
function revealOrigin(source?: ToggleSource) {
  const target = source?.currentTarget;
  if (target instanceof Element) {
    const rect = target.getBoundingClientRect();
    if (rect.width || rect.height) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth - 48, y: 32 };
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    // Light mode by default; dark only when the admin chose it on this device
    return 'light';
  });

  useEffect(() => {
    applyThemeClass(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const switchTo = useCallback((next: Theme, source?: ToggleSource) => {
    if (next === theme) return;
    const root = document.documentElement;
    const doc = document as ViewTransitionDocument;

    // Modern browsers: the new theme grows as a circle from the button.
    // Devices set to reduce motion get the gentle colour fade below instead.
    if (!prefersReducedMotion() && typeof doc.startViewTransition === 'function') {
      const { x, y } = revealOrigin(source);
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.classList.add('theme-reveal');
      const transition = doc.startViewTransition(() => {
        flushSync(() => setThemeState(next));
        applyThemeClass(next);
      });
      transition.ready
        .then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: REVEAL_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        })
        .catch(() => undefined);
      transition.finished.finally(() => root.classList.remove('theme-reveal'));
      return;
    }

    // Other browsers: colours fade smoothly
    root.classList.add('theme-fade');
    setThemeState(next);
    window.setTimeout(() => root.classList.remove('theme-fade'), FADE_MS + 50);
  }, [theme]);

  const toggleTheme = useCallback(
    (source?: ToggleSource) => switchTo(theme === 'dark' ? 'light' : 'dark', source),
    [switchTo, theme]
  );

  const setTheme = useCallback((newTheme: Theme) => switchTo(newTheme), [switchTo]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isDark: theme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
