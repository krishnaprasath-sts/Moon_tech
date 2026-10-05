import React, { useState, useEffect, useId } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { FormError, RequiredMark, OptionalMark, btnGhostClass, btnSuccessClass, btnDangerClass, labelClass, textareaClass } from './ui';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Receives the trimmed text. The parent closes the modal once the request succeeds.
  onSubmit: (text: string) => Promise<void> | void;
  title: string;
  subtitle?: string;
  description?: React.ReactNode;
  tone?: 'approve' | 'danger';
  inputLabel?: string;
  placeholder?: string;
  // 0 makes the text optional
  minLength?: number;
  maxLength?: number;
  // Set to false for plain confirmations that do not need a reason / remarks field
  showInput?: boolean;
  // Quick-select chips that fill the text field
  presets?: string[];
  confirmText: string;
  isLoading?: boolean;
  // Extra validation for fields rendered through children; return a message to block submit
  validate?: () => string | null;
  children?: React.ReactNode;
}

// Confirmation dialog with an optional reason / remarks field, used for every approve / reject / cancel action
export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  subtitle = 'This action is recorded in the activity log',
  description,
  tone = 'approve',
  inputLabel = 'Remarks',
  placeholder,
  minLength = 0,
  maxLength = 1000,
  showInput = true,
  presets,
  confirmText,
  isLoading = false,
  validate,
  children,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const textareaId = useId();

  // Reset the form every time the dialog opens
  useEffect(() => {
    if (isOpen) {
      setText('');
      setError('');
    }
  }, [isOpen]);

  const isDanger = tone === 'danger';

  const handleSubmit = async () => {
    if (isLoading) return;

    const value = text.trim();
    if (showInput && minLength > 0 && value.length < minLength) {
      setError(`${inputLabel} must be at least ${minLength} characters.`);
      return;
    }

    const extraError = validate?.();
    if (extraError) {
      setError(extraError);
      return;
    }

    setError('');
    await onSubmit(value);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={isDanger ? AlertTriangle : CheckCircle2}
      tone={isDanger ? 'danger' : 'success'}
      maxWidthClass="max-w-md"
      disableClose={isLoading}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isLoading} className={btnGhostClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={isDanger ? btnDangerClass : btnSuccessClass}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </>
      }
    >
      {description && (
        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{description}</div>
      )}

      <FormError message={error} />

      {children}

      {showInput && (
        <div>
          {presets && presets.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Quick select
              </p>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setText(preset);
                      setError('');
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition ${
                      text === preset
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label htmlFor={textareaId} className={labelClass}>
            {inputLabel}
            {minLength > 0 ? <RequiredMark /> : <OptionalMark />}
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={isLoading}
            className={textareaClass}
          />
          {minLength > 0 && (
            <p className="text-[10px] text-slate-400 mt-1">Minimum {minLength} characters.</p>
          )}
        </div>
      )}
    </ModalShell>
  );
};
