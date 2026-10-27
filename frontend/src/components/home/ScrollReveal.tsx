"use client";

import { useEffect } from 'react';

/**
 * Elements marked data-reveal rise gently into view the first time they scroll into the screen.
 * Only elements that start BELOW the screen are hidden first, so nothing already visible ever
 * blinks. Cards inside one group come in one after another (data-reveal-group on the parent).
 * Without JavaScript, or on devices set to reduce motion, everything simply shows.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const below = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.95);

    // Stagger siblings that share a group
    below.forEach((el) => {
      const group = el.closest('[data-reveal-group]');
      if (group) {
        const siblings = Array.from(group.querySelectorAll<HTMLElement>('[data-reveal]'));
        el.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(el), 6) * 70}ms`);
      }
      el.classList.add('reveal-pending');
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add('reveal-in');
          observer.unobserve(el);
          // Tidy up once shown so hover effects (lift, scale) work normally again
          window.setTimeout(() => {
            el.classList.remove('reveal-pending', 'reveal-in');
            el.style.removeProperty('--reveal-delay');
          }, 1200);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    below.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return null;
}
