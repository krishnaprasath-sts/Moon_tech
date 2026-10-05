import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const CopyButton: React.FC<{ value?: string | null; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast.error(`Could not copy ${label}. Please copy it manually.`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label}`}
      className="inline-flex items-center justify-center p-1 ml-1.5 align-middle rounded-md text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};
