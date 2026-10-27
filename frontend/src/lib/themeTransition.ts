import { flushSync } from 'react-dom';

/** Anything with a currentTarget, e.g. the click event of the theme button */
export type ThemeToggleSource = { currentTarget?: EventTarget | null };

const REVEAL_MS = 550;
const FADE_MS = 350;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

/** Centre of the pressed button, or the top-right corner (where the toggle sits) */
function revealOrigin(source?: ThemeToggleSource) {
  const target = source?.currentTarget;
  if (target instanceof Element) {
    const rect = target.getBoundingClientRect();
    if (rect.width || rect.height) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth - 48, y: 32 };
}

/**
 * Runs `update` (which must switch the theme) with an animation:
 * - modern browsers: the new theme grows as a circle from the pressed button
 * - others, or devices set to reduce motion: all colours fade for a moment
 */
export function runThemeTransition(update: () => void, source?: ThemeToggleSource) {
  const root = document.documentElement;
  const doc = document as ViewTransitionDocument;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  if (!reduceMotion && typeof doc.startViewTransition === 'function') {
    const { x, y } = revealOrigin(source);
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.classList.add('theme-reveal');
    try {
      const transition = doc.startViewTransition(() => flushSync(update));
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
    } catch {
      root.classList.remove('theme-reveal');
    }
  }

  root.classList.add('theme-fade');
  flushSync(update);
  window.setTimeout(() => root.classList.remove('theme-fade'), FADE_MS + 50);
}
