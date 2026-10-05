import React from 'react';
import { Loader2 } from 'lucide-react';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
}

// Accessible toggle switch used for plan status, early withdrawal and settings flags
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false, busy = false, title }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    aria-busy={busy || undefined}
    title={title}
    disabled={disabled || busy}
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 flex items-center flex-shrink-0 rounded-full p-1 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed ${
      checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
    }`}
  >
    <span
      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    >
      {busy && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
    </span>
  </button>
);
