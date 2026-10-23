import React, { useState, useEffect, useId } from 'react';
import { Wallet, Loader2, Save } from 'lucide-react';
import { usePlatformSettings, useUpdatePlatformSettings } from '../hooks/useFinance';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PlatformSettings } from '../types';
import { Switch } from './Switch';
import { Field, FormError, ErrorState, Spinner, ViewOnlyNote, inputClass, textareaClass, btnPrimaryClass, cardClass } from './ui';
import { getApiErrorMessage, hasMaxTwoDecimals } from '../utils/finance';

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^[0-9]{9,18}$/;

type FieldErrors = Partial<
  Record<
    | 'walletMinTopup'
    | 'walletMaxTopup'
    | 'depositInstructions'
    | 'bankAccountName'
    | 'bankAccountNumber'
    | 'bankIfsc'
    | 'bankName'
    | 'bankTransferInstructions'
    | 'walletMinWithdrawal'
    | 'referralCommissionPercent'
    | 'capitalWithdrawalFeePercent',
    string
  >
>;

export const WalletSettingsCard: React.FC = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const formId = useId();

  const { data: settings, isLoading, isError, error, refetch } = usePlatformSettings();
  const { mutateAsync: updateSettings, isPending } = useUpdatePlatformSettings();

  const [walletMinTopup, setWalletMinTopup] = useState('');
  const [walletMaxTopup, setWalletMaxTopup] = useState('');
  const [depositInstructions, setDepositInstructions] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankTransferInstructions, setBankTransferInstructions] = useState('');
  const [requireKyc, setRequireKyc] = useState(false);
  const [requireKycWithdrawal, setRequireKycWithdrawal] = useState(false);
  const [walletMinWithdrawal, setWalletMinWithdrawal] = useState('');
  const [referralCommissionPercent, setReferralCommissionPercent] = useState('');
  const [capitalWithdrawalFeePercent, setCapitalWithdrawalFeePercent] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setWalletMinTopup(String(settings.walletMinTopup ?? ''));
    setWalletMaxTopup(String(settings.walletMaxTopup ?? ''));
    setDepositInstructions(settings.depositInstructions || '');
    setBankAccountName(settings.bankAccountName || '');
    setBankAccountNumber(settings.bankAccountNumber || '');
    setBankIfsc(settings.bankIfsc || '');
    setBankName(settings.bankName || '');
    setBankTransferInstructions(settings.bankTransferInstructions || '');
    setRequireKyc(Boolean(settings.requireKycForInvestment));
    setRequireKycWithdrawal(Boolean(settings.requireKycForWithdrawal));
    setWalletMinWithdrawal(String(settings.walletMinWithdrawal ?? ''));
    setReferralCommissionPercent(String(settings.referralCommissionPercent ?? ''));
    setCapitalWithdrawalFeePercent(String(settings.capitalWithdrawalFeePercent ?? ''));
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
    if (depositInstructions.trim() !== (settings.depositInstructions || '')) {
      changes.depositInstructions = depositInstructions.trim();
    }
    if (bankAccountName.trim() !== (settings.bankAccountName || '')) changes.bankAccountName = bankAccountName.trim();
    if (bankAccountNumber.trim() !== (settings.bankAccountNumber || '')) changes.bankAccountNumber = bankAccountNumber.trim();
    if (bankIfsc.trim().toUpperCase() !== (settings.bankIfsc || '')) changes.bankIfsc = bankIfsc.trim().toUpperCase();
    if (bankName.trim() !== (settings.bankName || '')) changes.bankName = bankName.trim();
    if (bankTransferInstructions.trim() !== (settings.bankTransferInstructions || '')) {
      changes.bankTransferInstructions = bankTransferInstructions.trim();
    }
    if (requireKyc !== Boolean(settings.requireKycForInvestment)) changes.requireKycForInvestment = requireKyc;
    if (requireKycWithdrawal !== Boolean(settings.requireKycForWithdrawal)) {
      changes.requireKycForWithdrawal = requireKycWithdrawal;
    }
    if (Number(walletMinWithdrawal) !== Number(settings.walletMinWithdrawal)) {
      changes.walletMinWithdrawal = Number(walletMinWithdrawal);
    }
    if (Number(referralCommissionPercent) !== Number(settings.referralCommissionPercent)) {
      changes.referralCommissionPercent = Number(referralCommissionPercent);
    }
    if (Number(capitalWithdrawalFeePercent) !== Number(settings.capitalWithdrawalFeePercent)) {
      changes.capitalWithdrawalFeePercent = Number(capitalWithdrawalFeePercent);
    }

    return changes;
  };

  const percentError = (value: string): string | undefined => {
    const pct = Number(value);
    if (value.trim() === '' || !Number.isFinite(pct) || pct < 0) return 'Enter 0 or a positive percentage';
    if (pct > 100) return 'Cannot exceed 100%';
    if (!hasMaxTwoDecimals(value)) return 'Use at most 2 decimal places';
    return undefined;
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
    if (changes.walletMinWithdrawal !== undefined) next.walletMinWithdrawal = checkMoney(walletMinWithdrawal);
    if (changes.referralCommissionPercent !== undefined) {
      next.referralCommissionPercent = percentError(referralCommissionPercent);
    }
    if (changes.capitalWithdrawalFeePercent !== undefined) {
      next.capitalWithdrawalFeePercent = percentError(capitalWithdrawalFeePercent);
    }
    if (changes.depositInstructions !== undefined && changes.depositInstructions.length < 5) {
      next.depositInstructions = 'Instructions must be at least 5 characters';
    }

    // Bank transfer: all four destination fields together, or none
    const bankValues = {
      bankAccountName: bankAccountName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankIfsc: bankIfsc.trim().toUpperCase(),
      bankName: bankName.trim(),
    };
    const bankFilled = Object.values(bankValues).filter(Boolean).length;
    if (bankFilled > 0) {
      if (!bankValues.bankAccountName) next.bankAccountName = 'Required to offer bank transfers';
      if (!bankValues.bankAccountNumber) next.bankAccountNumber = 'Required to offer bank transfers';
      else if (!ACCOUNT_PATTERN.test(bankValues.bankAccountNumber)) next.bankAccountNumber = 'Account number must be 9-18 digits';
      if (!bankValues.bankIfsc) next.bankIfsc = 'Required to offer bank transfers';
      else if (!IFSC_PATTERN.test(bankValues.bankIfsc)) next.bankIfsc = 'Enter a valid IFSC, e.g. SBIN0001234';
      if (!bankValues.bankName) next.bankName = 'Required to offer bank transfers';
    }
    if (changes.bankTransferInstructions !== undefined && changes.bankTransferInstructions.length < 5) {
      next.bankTransferInstructions = 'Instructions must be at least 5 characters';
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
            Wallet top-up limits and the bank account customers transfer money to
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

          <Field
            label="Deposit instructions"
            htmlFor={`${formId}-instructions`}
            required
            error={errors.depositInstructions}
            hint="Shown to customers on the add money screen, under the bank details"
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

          {/* Bank transfer destination */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Bank transfer (NEFT / IMPS / RTGS)</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Customers add money by bank transfer only (NEFT / IMPS / RTGS). All four fields are needed before
                customers can add money.{' '}
                {bankAccountName && bankAccountNumber && bankIfsc && bankName ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Currently offered to customers.</span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">Customers cannot add money until these are filled in.</span>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Account holder name" htmlFor={`${formId}-bank-holder`} error={errors.bankAccountName}>
                <input
                  id={`${formId}-bank-holder`}
                  type="text"
                  value={bankAccountName}
                  disabled={readOnly}
                  maxLength={100}
                  onChange={(e) => {
                    setBankAccountName(e.target.value);
                    clear('bankAccountName');
                  }}
                  placeholder="e.g. Moon Tech Solutions Pvt Ltd"
                  className={inputClass}
                />
              </Field>
              <Field label="Bank name" htmlFor={`${formId}-bank-name`} error={errors.bankName}>
                <input
                  id={`${formId}-bank-name`}
                  type="text"
                  value={bankName}
                  disabled={readOnly}
                  maxLength={100}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    clear('bankName');
                  }}
                  placeholder="e.g. State Bank of India, Anna Nagar branch"
                  className={inputClass}
                />
              </Field>
              <Field label="Account number" htmlFor={`${formId}-bank-account`} error={errors.bankAccountNumber} hint="9 to 18 digits">
                <input
                  id={`${formId}-bank-account`}
                  type="text"
                  inputMode="numeric"
                  value={bankAccountNumber}
                  disabled={readOnly}
                  maxLength={18}
                  onChange={(e) => {
                    setBankAccountNumber(e.target.value.replace(/\D/g, ''));
                    clear('bankAccountNumber');
                  }}
                  placeholder="e.g. 123456789012"
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="IFSC code" htmlFor={`${formId}-bank-ifsc`} error={errors.bankIfsc} hint="11 characters; the 5th is always zero">
                <input
                  id={`${formId}-bank-ifsc`}
                  type="text"
                  value={bankIfsc}
                  disabled={readOnly}
                  maxLength={11}
                  onChange={(e) => {
                    setBankIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    clear('bankIfsc');
                  }}
                  placeholder="e.g. SBIN0001234"
                  className={`${inputClass} font-mono uppercase`}
                />
              </Field>
            </div>
            <Field
              label="Bank transfer instructions"
              htmlFor={`${formId}-bank-instructions`}
              error={errors.bankTransferInstructions}
              hint="Shown to customers who choose bank transfer"
            >
              <textarea
                id={`${formId}-bank-instructions`}
                rows={2}
                value={bankTransferInstructions}
                disabled={readOnly}
                maxLength={1000}
                onChange={(e) => {
                  setBankTransferInstructions(e.target.value);
                  clear('bankTransferInstructions');
                }}
                placeholder="e.g. Transfer the exact amount by IMPS or NEFT and upload the confirmation screenshot"
                className={textareaClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field
              label="Minimum profit withdrawal (₹)"
              htmlFor={`${formId}-min-withdrawal`}
              required
              error={errors.walletMinWithdrawal}
              hint="Smallest amount a customer can withdraw from their profit wallet"
            >
              <input
                id={`${formId}-min-withdrawal`}
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={walletMinWithdrawal}
                disabled={readOnly}
                onChange={(e) => {
                  setWalletMinWithdrawal(e.target.value);
                  clear('walletMinWithdrawal');
                }}
                className={`${inputClass} font-mono font-bold`}
              />
            </Field>
            <Field
              label="Referral commission (%)"
              htmlFor={`${formId}-commission`}
              required
              error={errors.referralCommissionPercent}
              hint="Paid once to the referrer at 6:00 AM, 24 hours after a referred customer invests. 0 switches it off."
            >
              <input
                id={`${formId}-commission`}
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                value={referralCommissionPercent}
                disabled={readOnly}
                onChange={(e) => {
                  setReferralCommissionPercent(e.target.value);
                  clear('referralCommissionPercent');
                }}
                className={`${inputClass} font-mono font-bold`}
              />
            </Field>
            <Field
              label="Early withdrawal fee (%)"
              htmlFor={`${formId}-capital-fee`}
              required
              error={errors.capitalWithdrawalFeePercent}
              hint="Deducted from the capital only when a customer closes an investment before it ends. Matured capital, the capital wallet and profit are paid in full. Snapshotted on each new investment."
            >
              <input
                id={`${formId}-capital-fee`}
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                value={capitalWithdrawalFeePercent}
                disabled={readOnly}
                onChange={(e) => {
                  setCapitalWithdrawalFeePercent(e.target.value);
                  clear('capitalWithdrawalFeePercent');
                }}
                className={`${inputClass} font-mono font-bold`}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Require KYC for withdrawal</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                When enabled, only KYC verified customers can request payouts to their bank or UPI
              </p>
            </div>
            <Switch
              checked={requireKycWithdrawal}
              onChange={setRequireKycWithdrawal}
              label="Require KYC for withdrawal"
              disabled={readOnly || isPending}
            />
          </div>

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
