"use client";

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => { finished: Promise<void> };
};

/** Longest the old page stays frozen on screen while the next one loads */
const MAX_WAIT_MS = 1500;

/**
 * Smooth page changes: internal link clicks run inside a View Transition, so the old page
 * cross-fades straight into the new one (no blank frame). The header, sign-in card and the
 * active Sign In / Create Account tab carry view-transition names (globals.css), so they stay
 * put, resize or slide instead of fading. Browsers without View Transitions, and devices set
 * to reduce motion, navigate normally.
 */
export function RouteTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<(() => void) | null>(null);

  // The new route has rendered: let the transition capture it. (Not via requestAnimationFrame:
  // the browser pauses frames while a view transition waits, so that would never fire in time.)
  useEffect(() => {
    const finish = pending.current;
    if (!finish) return;
    pending.current = null;
    finish();
  }, [pathname]);

  useEffect(() => {
    const doc = document as ViewTransitionDocument;
    if (typeof doc.startViewTransition !== 'function') return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download') || anchor.dataset.noTransition !== undefined) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (only the #section or nothing changes): let the browser scroll smoothly
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      const href = url.pathname + url.search + url.hash;

      doc.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(() => {
              pending.current = null;
              resolve();
            }, MAX_WAIT_MS);
            pending.current = () => {
              window.clearTimeout(timer);
              resolve();
            };
            router.push(href);
          })
      );
    };

    // Capture phase: runs before Next's <Link> handler, which then sees defaultPrevented and stands down
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return null;
}
