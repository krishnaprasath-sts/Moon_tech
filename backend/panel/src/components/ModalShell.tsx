import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, LucideIcon } from 'lucide-react';
import { useModalBehaviour } from '../hooks/useModalBehaviour';

export type ModalTone = 'brand' | 'success' | 'danger' | 'warning';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  icon: LucideIcon;
  tone?: ModalTone;
  maxWidthClass?: string;
  footer?: React.ReactNode;
  // Blocks Escape, backdrop and the X button while a request is in flight
  disableClose?: boolean;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<ModalTone, string> = {
  brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

// Base dialog: portal, backdrop, Escape, focus trap, scroll lock and a header / body / footer layout
// that fits the viewport on phones (internal scroll) and desktops alike.
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = 'brand',
  maxWidthClass = 'max-w-2xl',
  footer,
  disableClose = false,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useModalBehaviour({ isOpen, onClose, disableClose, panelRef });

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!disableClose) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div onClick={handleBackdropClick} className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${maxWidthClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-h-[calc(100vh-1.5rem)] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto animate-fadeIn focus:outline-none`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex-shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`p-2.5 rounded-xl border flex-shrink-0 ${TONE_CLASSES[tone]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</div>}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={disableClose}
            aria-label="Close dialog"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">{children}</div>

        {/* Footer Actions */}
        {footer && (
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export const DetailField: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({
  label,
  children,
  mono = false,
}) => (
  <div className="min-w-0">
    <span className="text-slate-500 block text-[11px] uppercase">{label}</span>
    <span className={`text-slate-800 dark:text-slate-200 font-medium break-words ${mono ? 'font-mono' : ''}`}>
      {children}
    </span>
  </div>
);

export const DetailSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h4>
    {children}
  </div>
);
