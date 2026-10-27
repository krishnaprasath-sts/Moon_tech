import React, { useState, useEffect, useId } from 'react';
import { Loader2, Sparkles, PiggyBank, Calculator } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { Switch } from './Switch';
import { InvestmentPlan, InvestmentPlanPayload, ProfitType, ProfitPayoutMode, RateBasis } from '../types';
import { useCreateInvestmentPlan, useUpdateInvestmentPlan } from '../hooks/useFinance';
import { useToast } from '../context/ToastContext';
import { Field, FormError, inputClass, textareaClass, btnGhostClass, btnPrimaryClass } from './ui';
import { formatINR, getApiErrorMessage, hasMaxTwoDecimals } from '../utils/finance';

interface InvestmentPlanModalProps {
  plan: InvestmentPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// 0 = open-ended (daily-profit plans only)
const DURATION_PRESETS = [0, 30, 90, 180, 365];
/** Monthly profit is paid as 4 weeks x 5 working days of equal credits */
const CREDITS_PER_MONTH = 20;
const CREDITS_PER_WEEK = 5;

const EMPTY_FORM = {
  name: '',
  description: '',
  minAmount: '',
  maxAmount: '',
  durationDays: '0',
  lockInDays: '0',
  profitValue: '',
  sortOrder: '0',
  featuredTagline: '',
};

type FormState = typeof EMPTY_FORM;
type FormErrors = Partial<Record<keyof FormState, string>>;

export const InvestmentPlanModal: React.FC<InvestmentPlanModalProps> = ({ plan, isOpen, onClose, onSuccess }) => {
  const isEditMode = !!plan;
  const formId = useId();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [profitType, setProfitType] = useState<ProfitType>('PERCENTAGE');
  const [payoutMode, setPayoutMode] = useState<ProfitPayoutMode>('DAILY');
  const [rateBasis, setRateBasis] = useState<RateBasis>('PER_MONTH');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { mutateAsync: createPlan, isPending: isCreating } = useCreateInvestmentPlan();
  const { mutateAsync: updatePlan, isPending: isUpdating } = useUpdateInvestmentPlan();
  const { toast } = useToast();

  const isPending = isCreating || isUpdating;

  // Load the plan being edited (or a blank form) every time the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    if (plan) {
      setForm({
        name: plan.name || '',
        description: plan.description || '',
        minAmount: String(plan.minAmount ?? ''),
        maxAmount: String(plan.maxAmount ?? ''),
        durationDays: String(plan.durationDays ?? 0),
        lockInDays: String(plan.lockInDays ?? 0),
        profitValue: String(plan.profitValue ?? ''),
        sortOrder: String(plan.sortOrder ?? 0),
        featuredTagline: plan.featuredTagline || '',
      });
      setProfitType(plan.profitType || 'PERCENTAGE');
      setPayoutMode(plan.payoutMode || 'AT_MATURITY');
      setRateBasis(plan.rateBasis || (plan.payoutMode === 'DAILY' ? 'PER_DAY' : 'PER_MONTH'));
      setIsActive(plan.isActive ?? true);
      setIsFeatured(Boolean(plan.isFeatured));
    } else {
      setForm(EMPTY_FORM);
      setProfitType('PERCENTAGE');
      setPayoutMode('DAILY');
      setRateBasis('PER_MONTH');
      setIsActive(true);
      setIsFeatured(false);
    }
    setErrors({});
    setFormError(null);
  }, [plan, isOpen]);

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Live example based on the minimum investment amount
  const exampleAmount = Number(form.minAmount);
  const exampleProfitValue = Number(form.profitValue);
  const exampleDays = Number(form.durationDays);
  const isDaily = payoutMode === 'DAILY';
  const isOpenEnded = isDaily && exampleDays === 0;
  const hasExample =
    form.minAmount !== '' &&
    form.profitValue !== '' &&
    Number.isFinite(exampleAmount) &&
    exampleAmount > 0 &&
    Number.isFinite(exampleProfitValue) &&
    exampleProfitValue > 0 &&
    Number.isInteger(exampleDays) &&
    (exampleDays >= 1 || isOpenEnded);
  // Daily plans pay Monday-Friday after the start day; monthly plans cap at 20 credits per 30-day cycle
  const examplePayingDays = (() => {
    if (!isDaily || !Number.isInteger(exampleDays) || exampleDays < 1) return 0;
    const perCycle = new Map<number, number>();
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (let i = 1; i <= exampleDays; i += 1) {
      cursor.setDate(cursor.getDate() + 1);
      const day = cursor.getDay();
      if (day === 0 || day === 6) continue;
      if (rateBasis !== 'PER_DAY') {
        const cycle = Math.floor((i - 1) / 30);
        const used = perCycle.get(cycle) ?? 0;
        if (used >= CREDITS_PER_MONTH) continue;
        perCycle.set(cycle, used + 1);
      }
      count += 1;
    }
    return count;
  })();
  const examplePercentPaise = Math.round(exampleAmount * exampleProfitValue);
  const exampleDailyProfit =
    Math.round(examplePercentPaise / (rateBasis === 'PER_MONTH' ? CREDITS_PER_MONTH : rateBasis === 'PER_YEAR' ? 12 * CREDITS_PER_MONTH : 1)) /
    100;
  const exampleWeeklyProfit = Math.round(exampleDailyProfit * CREDITS_PER_WEEK * 100) / 100;
  const exampleMonthlyProfit = Math.round(exampleDailyProfit * CREDITS_PER_MONTH * 100) / 100;
  const exampleProfit = isDaily
    ? Math.round(exampleDailyProfit * examplePayingDays * 100) / 100
    : profitType === 'PERCENTAGE'
    ? Math.round(exampleAmount * exampleProfitValue) / 100
    : exampleProfitValue;

  const moneyError = (value: string, label: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return `${label} is required`;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return `${label} must be greater than 0`;
    if (!hasMaxTwoDecimals(trimmed)) return 'Use at most 2 decimal places';
    return undefined;
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    const cleanName = form.name.trim();
    if (cleanName.length < 2) next.name = 'Plan name must be at least 2 characters';
    else if (cleanName.length > 100) next.name = 'Plan name cannot exceed 100 characters';

    next.minAmount = moneyError(form.minAmount, 'Minimum investment');
    next.maxAmount = moneyError(form.maxAmount, 'Maximum investment');
    if (!next.minAmount && !next.maxAmount && Number(form.maxAmount) < Number(form.minAmount)) {
      next.maxAmount = 'Maximum cannot be less than the minimum';
    }

    next.profitValue = moneyError(form.profitValue, profitType === 'PERCENTAGE' ? 'Profit percentage' : 'Fixed profit');

    if (!/^\d+$/.test(form.durationDays.trim())) {
      next.durationDays = 'Enter a whole number of days (0 = open-ended)';
    } else if (Number(form.durationDays) > 3650) {
      next.durationDays = 'Period cannot exceed 3650 days';
    } else if (Number(form.durationDays) === 0 && !isDaily) {
      next.durationDays = 'Only daily-profit plans can be open-ended; set a period';
    }

    if (!/^\d+$/.test(form.lockInDays.trim() || '0')) {
      next.lockInDays = 'Enter a whole number of days (0 = no lock-in)';
    } else if (Number(form.lockInDays) > 3650) {
      next.lockInDays = 'Lock-in cannot exceed 3650 days';
    } else if (!next.durationDays && Number(form.durationDays) > 0 && Number(form.lockInDays) > Number(form.durationDays)) {
      next.lockInDays = 'Lock-in cannot be longer than the period';
    }

    if (!/^\d+$/.test(form.sortOrder.trim() || '0') || Number(form.sortOrder) > 9999) {
      next.sortOrder = 'Enter a whole number between 0 and 9999';
    }

    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as FormErrors;
    setErrors(cleaned);
    return Object.keys(cleaned).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setFormError(null);
    if (!validate()) return;

    const payload: InvestmentPlanPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      minAmount: Number(form.minAmount),
      maxAmount: Number(form.maxAmount),
      durationDays: Number(form.durationDays),
      lockInDays: Number(form.lockInDays.trim() || '0'),
      profitType: isDaily ? 'PERCENTAGE' : profitType,
      profitValue: Number(form.profitValue),
      payoutMode,
      rateBasis: isDaily ? rateBasis : 'PER_MONTH',
      isActive,
      isFeatured,
      featuredTagline: isFeatured ? form.featuredTagline.trim() || null : null,
      sortOrder: Number(form.sortOrder.trim() || '0'),
    };

    try {
      if (isEditMode && plan) {
        await updatePlan({ id: plan.id, data: payload });
        toast.success(`Plan "${payload.name}" has been updated`, 'Plan saved');
      } else {
        await createPlan(payload);
        toast.success(
          `Plan "${payload.name}" is ${isActive ? 'live and visible to customers' : 'saved as inactive'}`,
          'Plan created'
        );
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to save the investment plan');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `Edit Plan: ${plan?.name}` : 'Create Investment Plan'}
      subtitle="Investment limits, term and profit rate"
      icon={PiggyBank}
      disableClose={isPending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isPending} className={btnGhostClass}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isPending} className={btnPrimaryClass}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isEditMode ? 'Update Plan' : 'Create Plan'}
              </>
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError message={formError} />

        <Field label="Plan name" htmlFor={`${formId}-name`} required error={errors.name}>
          <input
            id={`${formId}-name`}
            type="text"
            value={form.name}
            onChange={update('name')}
            placeholder="e.g. Growth 90"
            maxLength={100}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Minimum investment (₹)" htmlFor={`${formId}-min`} required error={errors.minAmount}>
            <input
              id={`${formId}-min`}
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={form.minAmount}
              onChange={update('minAmount')}
              placeholder="5000"
              className={`${inputClass} font-mono font-bold`}
            />
          </Field>

          <Field label="Maximum investment (₹)" htmlFor={`${formId}-max`} required error={errors.maxAmount}>
            <input
              id={`${formId}-max`}
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={form.maxAmount}
              onChange={update('maxAmount')}
              placeholder="200000"
              className={`${inputClass} font-mono font-bold`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor={`${formId}-days`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Term (days) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1" aria-label="Common periods">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, durationDays: String(d) }));
                      setErrors((prev) => ({ ...prev, durationDays: undefined }));
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                      Number(form.durationDays) === d
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {d === 0 ? 'Open' : `${d}d`}
                  </button>
                ))}
              </div>
            </div>
            <input
              id={`${formId}-days`}
              type="number"
              step="1"
              min="0"
              max="3650"
              inputMode="numeric"
              value={form.durationDays}
              onChange={update('durationDays')}
              placeholder="0"
              className={inputClass}
            />
            {errors.durationDays ? (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1" role="alert">
                {errors.durationDays}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                0 = open-ended: runs until the customer withdraws the capital. Otherwise the capital returns to the
                capital wallet at maturity.
              </p>
            )}
          </div>

        </div>

        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Profit payout <span className="text-rose-500">*</span>
          </p>
          <div role="radiogroup" aria-label="Profit payout" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                {
                  mode: 'DAILY' as ProfitPayoutMode,
                  title: 'Daily (working days)',
                  text: 'Split into equal credits paid to the profit wallet every Monday-Friday at 6:00 AM IST.',
                },
                {
                  mode: 'MONTHLY' as ProfitPayoutMode,
                  title: 'Monthly (anniversary date)',
                  text: 'Credited once every month on the start date anniversary at 6:00 AM IST. Capital back at maturity.',
                },
                {
                  mode: 'AT_MATURITY' as ProfitPayoutMode,
                  title: 'At maturity',
                  text: 'Profit is paid together with the principal when the term ends.',
                },
              ]
            ).map((option) => (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={payoutMode === option.mode}
                onClick={() => {
                  setPayoutMode(option.mode);
                  if (option.mode === 'DAILY' || option.mode === 'MONTHLY') setProfitType('PERCENTAGE');
                }}
                className={`text-left p-3 rounded-2xl border transition ${
                  payoutMode === option.mode
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white">{option.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{option.text}</p>
              </button>
            ))}
          </div>
        </div>

        {isDaily && (
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Rate basis <span className="text-rose-500">*</span>
            </p>
            <div
              role="radiogroup"
              aria-label="Rate basis"
              className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              {(
                [
                  { basis: 'PER_MONTH' as RateBasis, label: 'Per month', hint: `÷ ${CREDITS_PER_MONTH} credits` },
                  { basis: 'PER_YEAR' as RateBasis, label: 'Per year', hint: `÷ ${12 * CREDITS_PER_MONTH} credits` },
                  { basis: 'PER_DAY' as RateBasis, label: 'Per working day', hint: 'legacy' },
                ]
              ).map((option) => (
                <button
                  key={option.basis}
                  type="button"
                  role="radio"
                  aria-checked={rateBasis === option.basis}
                  onClick={() => setRateBasis(option.basis)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                    rateBasis === option.basis
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                  <span className="block text-[10px] font-medium opacity-70">{option.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Monthly plans pay at most {CREDITS_PER_MONTH} credits per 30-day cycle ({CREDITS_PER_WEEK} a week), so a month never
              pays more than the rate. Profit is never added to the capital.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Profit type <span className="text-rose-500">*</span>
            </p>
            <div
              role="radiogroup"
              aria-label="Profit type"
              className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              {(['PERCENTAGE', 'FIXED'] as ProfitType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={profitType === type}
                  disabled={isDaily && type === 'FIXED'}
                  title={isDaily && type === 'FIXED' ? 'Daily-profit plans always use a percentage of the principal' : undefined}
                  onClick={() => setProfitType(type)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                    profitType === type
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {type === 'PERCENTAGE' ? 'Percentage (%)' : 'Fixed (₹)'}
                </button>
              ))}
            </div>
          </div>

          <Field
            label={
              isDaily
                ? rateBasis === 'PER_MONTH'
                  ? 'Profit percentage per month'
                  : rateBasis === 'PER_YEAR'
                  ? 'Profit percentage per year'
                  : 'Profit percentage per working day'
                : profitType === 'PERCENTAGE'
                ? 'Profit percentage'
                : 'Fixed profit amount'
            }
            htmlFor={`${formId}-profit`}
            required
            error={errors.profitValue}
            hint={
              isDaily
                ? 'Percentage of the invested capital; split into equal working-day credits'
                : profitType === 'PERCENTAGE'
                ? 'Percentage of the principal earned over the whole period'
                : 'Rupee amount paid at maturity regardless of the principal'
            }
          >
            <div className="relative">
              <input
                id={`${formId}-profit`}
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={form.profitValue}
                onChange={update('profitValue')}
                placeholder={profitType === 'PERCENTAGE' ? '10' : '1200'}
                className={`${inputClass} pr-8 font-mono font-bold text-emerald-600 dark:text-emerald-400`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400" aria-hidden="true">
                {profitType === 'PERCENTAGE' ? '%' : '₹'}
              </span>
            </div>
          </Field>
        </div>

        {/* Live example */}
        <div className="p-3.5 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-500/20 rounded-2xl flex items-start gap-2.5 text-xs">
          <Calculator className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
          {hasExample ? (
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {isDaily ? (
                <>
                  Investing <strong className="text-slate-900 dark:text-white">{formatINR(exampleAmount)}</strong> earns{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(exampleMonthlyProfit)}</strong> a month, paid as{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(exampleWeeklyProfit)}</strong> a week and{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(exampleDailyProfit)}</strong> every working day
                  at 6:00 AM.{' '}
                  {isOpenEnded ? (
                    <>Open-ended: it keeps paying until the customer withdraws the capital.</>
                  ) : (
                    <>
                      About <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(exampleProfit)}</strong> over{' '}
                      <strong className="text-slate-900 dark:text-white">{examplePayingDays} paying days</strong> in {exampleDays} days;
                      the capital returns to the capital wallet at maturity.
                    </>
                  )}
                </>
              ) : (
                <>
                  Investing <strong className="text-slate-900 dark:text-white">{formatINR(exampleAmount)}</strong> returns{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(exampleAmount + exampleProfit)}</strong>{' '}
                  after <strong className="text-slate-900 dark:text-white">{exampleDays} days</strong>{' '}
                  <span className="text-slate-500 dark:text-slate-400">({formatINR(exampleProfit)} profit)</span>
                </>
              )}
            </p>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">
              Enter the minimum investment and profit rate to preview the daily, weekly and monthly profit.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field
            label="Display order"
            htmlFor={`${formId}-sort`}
            optional
            error={errors.sortOrder}
            hint="Lower numbers appear first in the customer app"
          >
            <input
              id={`${formId}-sort`}
              type="number"
              step="1"
              min="0"
              max="9999"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={update('sortOrder')}
              placeholder="0"
              className={inputClass}
            />
          </Field>

          <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl self-end">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Active</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Only active plans are offered to customers</p>
            </div>
            <Switch checked={isActive} onChange={setIsActive} label="Plan is active" disabled={isPending} />
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Featured on website</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Shown on the Featured Plans page in sort order. Only active plans appear.
              </p>
            </div>
            <Switch checked={isFeatured} onChange={setIsFeatured} label="Plan is featured on the website" disabled={isPending} />
          </div>
          {isFeatured && (
            <Field label="Featured tagline" htmlFor={`${formId}-featured-tagline`} optional hint={`${form.featuredTagline.length}/160`}>
              <input
                id={`${formId}-featured-tagline`}
                type="text"
                value={form.featuredTagline}
                onChange={update('featuredTagline')}
                maxLength={160}
                placeholder="e.g. Our most popular plan: balanced term with a strong expected return"
                className={inputClass}
                disabled={isPending}
              />
            </Field>
          )}
        </div>

        <Field label="Description" htmlFor={`${formId}-description`} optional>
          <textarea
            id={`${formId}-description`}
            rows={2}
            value={form.description}
            onChange={update('description')}
            maxLength={2000}
            placeholder="e.g. 90 day plan with profit credited to the wallet at maturity"
            className={textareaClass}
          />
        </Field>
      </form>
    </ModalShell>
  );
};
