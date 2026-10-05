"use client";

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EarningCalculator } from './EarningCalculator';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickCalculatorModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEsc);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Returns calculator"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-2 sm:p-4 shadow-2xl transition-colors duration-200 focus:outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-zinc-950 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pt-2">
          <EarningCalculator compact={true} />
        </div>
      </div>
    </div>
  );
};
