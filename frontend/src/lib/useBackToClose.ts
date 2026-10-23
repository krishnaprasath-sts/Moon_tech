"use client";

import { useEffect, useRef } from 'react';

const MODAL_STATE_KEY = 'moontechModal';

/**
 * Makes the phone back button (and browser back) close an open modal instead of
 * leaving the page. While `isOpen`, one history entry is pushed for the modal;
 * a back navigation pops it and calls `onClose`. Close buttons should go through
 * `requestClose`, which pops that entry so the history stays clean.
 *
 * Next.js merges its own router state into the pushed entry, so the page tree is
 * restored unchanged when the entry is popped.
 */
export function useBackToClose(isOpen: boolean, onClose: () => void): { requestClose: () => void } {
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    closingRef.current = false;
    if (!window.history.state?.[MODAL_STATE_KEY]) {
      window.history.pushState({ ...window.history.state, [MODAL_STATE_KEY]: true }, '', window.location.href);
    }
    const handlePop = () => {
      closingRef.current = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [isOpen]);

  const requestClose = () => {
    if (closingRef.current) return;
    if (typeof window !== 'undefined' && window.history.state?.[MODAL_STATE_KEY]) {
      closingRef.current = true;
      // Popping the modal entry fires popstate, which closes the modal
      window.history.back();
      return;
    }
    onCloseRef.current();
  };

  return { requestClose };
}
