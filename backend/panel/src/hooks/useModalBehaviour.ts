import { RefObject, useEffect, useRef } from 'react';

interface ModalBehaviourOptions {
  isOpen: boolean;
  onClose: () => void;
  // Blocks Escape / backdrop closing while a request is in flight
  disableClose?: boolean;
  panelRef: RefObject<HTMLElement>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Stack of open modals so only the top-most one reacts to Escape when modals are nested
const openModals: symbol[] = [];

// Shared modal behaviour: body scroll lock, Escape to close, focus trap and focus restore.
// The effect only runs on open / close - callbacks are read through refs so a parent re-render
// (e.g. an inline onClose) never re-focuses the panel while the user is typing.
export const useModalBehaviour = ({ isOpen, onClose, disableClose = false, panelRef }: ModalBehaviourOptions) => {
  const onCloseRef = useRef(onClose);
  const disableCloseRef = useRef(disableClose);

  useEffect(() => {
    onCloseRef.current = onClose;
    disableCloseRef.current = disableClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    const id = Symbol('modal');
    openModals.push(id);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });

    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) || []);

    const handleKeyDown = (event: KeyboardEvent) => {
      const isTopMost = openModals[openModals.length - 1] === id;
      if (!isTopMost) return;

      if (event.key === 'Escape') {
        if (!disableCloseRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab' || !panel) return;

      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const index = openModals.indexOf(id);
      if (index >= 0) openModals.splice(index, 1);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, panelRef]);
};
