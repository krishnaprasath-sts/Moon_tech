import React, { useState, useEffect, useId } from 'react';
import { Wallet, Loader2, Save } from 'lucide-react';
import { usePlatformSettings, useUpdatePlatformSettings } from '../hooks/useFinance';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PlatformSettings } from '../types';
import { Switch } from './Switch';
import { Field, FormError, ErrorState, Spinner, ViewOnlyNote, inputClass, textareaClass, btnPrimaryClass, cardClass } from './ui';
import { getApiErrorMessage, hasMaxTwoDecimals } from '../utils/finance';

const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;

type FieldErrors = Partial<Record<'walletMinTopup' | 'walletMaxTopup' | 'upiId' | 'upiPayeeName' | 'depositInstructions', string>>;

export const WalletSettingsCard: React.FC = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const formId = useId();

  const { data: settings, isLoading, isError, error, refetch } = usePlatformSettings();
  const { mutateAsync: updateSettings, isPending } = useUpdatePlatformSettings();

  const [walletMinTopup, setWalletMinTopup] = useState('');
  const [walletMaxTopup, setWalletMaxTopup] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [depositInstructions, setDepositInstructions] = useState('');
  const [requireKyc, setRequireKyc] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setWalletMinTopup(String(settings.walletMinTopup ?? ''));
    setWalletMaxTopup(String(settings.walletMaxTopup ?? ''));
    setUpiId(settings.upiId || '');
    setUpiPayeeName(settings.upiPayeeName || '');
    setDepositInstructions(settings.depositInstructions || '');
    setRequireKyc(Boolean(settings.requireKycForInvestment));
    setErrors({});
    setFormError(null);
  }, [settings]);

  const readOnly = !isAdmin;

  // Only changed fields are sent, so an untouched field can never fail server validation
  const buildChanges = (): Partial<PlatformSettings> => {
    if (!settings) return {};
    const changes: Partial<PlatformSettings> = {};

    if (Number(walletMinTopup) !== Number(settings.walletMinTopup)) changes.walletMinTopup = Number(walletMinTopup);
    if (Number(walletMaxTopup) !== Number(settings.walletMaxTopup)) changes.walletMaxTopup = Number(walletMaxTopup);
    if (upiId.trim() !== (settings.upiId || '')) changes.upiId = upiId.trim();
    if (upiPayeeName.trim() !== (settings.upiPayeeName || '')) changes.upiPayeeName = upiPayeeName.trim();
    if (depositInstructions.trim() !== (settings.depositInstructions || '')) {
      changes.depositInstructions = depositInstructions.trim();
    }
    if (requireKyc !== Boolean(settings.requireKycForInvestment)) changes.requireKycForInvestment = requireKyc;

    return changes;
  };

  const validate = (changes: Partial<PlatformSettings>): boolean => {
    const next: FieldErrors = {};

    const checkMoney = (value: string) => {
      const num = Number(value);
      if (value.trim() === '' || !Number.isFinite(num) || num <= 0) return 'Must be greater than 0';
      if (!hasMaxTwoDecimals(value)) return 'Use at most 2 decimal places';
      return undefined;
    };

    next.walletMinTopup = checkMoney(walletMinTopup);
    next.walletMaxTopup = checkMoney(walletMaxTopup);
    if (!next.walletMinTopup && !next.walletMaxTopup && Number(walletMaxTopup) < Number(walletMinTopup)) {
      next.walletMaxTopup = 'Maximum cannot be less than the minimum';
    }
    if (changes.upiId !== undefined && !UPI_PATTERN.test(changes.upiId)) next.upiId = 'Enter a valid UPI ID, e.g. business@upi';
    if (changes.upiPayeeName !== undefined && changes.upiPayeeName.length < 2) next.upiPayeeName = 'Payee name must be at least 2 characters';
    if (changes.depositInstructions !== undefined && changes.depositInstructions.length < 5) {
      next.depositInstructions = 'Instructions must be at least 5 characters';
    }

    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as FieldErrors;
    setErrors(cleaned);
    return Object.keys(cleaned).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || isPending) return;
    setFormError(null);

    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      toast.info('No changes to save');
      return;
    }
    if (!validate(changes)) return;

    try {
      await updateSettings(changes);
      const changed = Object.keys(changes).length;
      toast.success(`${changed} setting${changed === 1 ? '' : 's'} updated. Customers see the new values immediately.`, 'Settings saved');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to save settings');
      setFormError(msg);
      toast.error(msg);
    }
  };

  const clear = (key: keyof FieldErrors) => setErrors((prev) => ({ ...prev, [key]: undefined }));

  return (
    <div className={`${cardClass} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            Wallet & Payment Settings
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Wallet top-up limits and the UPI details customers pay to
          </p>
        </div>
        {readOnly && <ViewOnlyNote />}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          <Spinner className="w-6 h-6 mx-auto mb-2" />
          Loading settings...
        </div>
      ) : isError || !settings ? (
        <ErrorState message={getApiErrorMessage(error, 'Failed to load settings.')} onRetry={() => refetch()} />
      ) : (
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormError message={formError} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Minimum wallet top-up (₹)" htmlFor={`${formId}-min`} required error={errors.walletMinTopup}>
              <input
                id={`${formId}-min`}
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={walletMinTopup}
                disabled={readOnly}
                onChange={(e) => {
                  setWalletMinTopup(e.target.value);
                  clear('walletMinTopup');
                }}
                className={`${inputClass} font-mono font-bold`}
              />
            </Field>
            <Field label="Maximum wallet top-up (₹)" htmlFor={`${formId}-max`} required error={errors.walletMaxTopup}>
              <input
                id={`${formId}-max`}
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={walletMaxTopup}
                disabled={readOnly}
                onChange={(e) => {
                  setWalletMaxTopup(e.target.value);
                  clear('walletMaxTopup');
                }}
                className={`${inputClass} font-mono font-bold`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Business UPI ID" htmlFor={`${formId}-upi`} required error={errors.upiId}>
              <input
                id={`${formId}-upi`}
                type="text"
                value={upiId}
                disabled={readOnly}
                onChange={(e) => {
                  setUpiId(e.target.value);
                  clear('upiId');
                }}
                placeholder="business@upi"
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="UPI payee name" htmlFor={`${formId}-payee`} required error={errors.upiPayeeName}>
              <input
                id={`${formId}-payee`}
                type="text"
                value={upiPayeeName}
                disabled={readOnly}
                maxLength={100}
                onChange={(e) => {
                  setUpiPayeeName(e.target.value);
                  clear('upiPayeeName');
                }}
                placeholder="Name shown in the customer's UPI app"
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Deposit instructions"
            htmlFor={`${formId}-instructions`}
            required
            error={errors.depositInstructions}
            hint="Shown to customers on the add money screen"
          >
            <textarea
              id={`${formId}-instructions`}
              rows={3}
              value={depositInstructions}
              disabled={readOnly}
              maxLength={1000}
              onChange={(e) => {
                setDepositInstructions(e.target.value);
                clear('depositInstructions');
              }}
              placeholder="e.g. Pay the exact amount to the UPI ID above and upload the receipt screenshot"
              className={textareaClass}
            />
          </Field>

          <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Require KYC for investment</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                When enabled, only KYC verified customers can create investments
              </p>
            </div>
            <Switch
              checked={requireKyc}
              onChange={setRequireKyc}
              label="Require KYC for investment"
              disabled={readOnly || isPending}
            />
          </div>

          {!readOnly && (
            <div className="flex justify-end">
              <button type="submit" disabled={isPending} className={btnPrimaryClass}>
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
