import React, { useState, useEffect, useId } from 'react';
import { Loader2, Sparkles, PiggyBank, Calculator } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { Switch } from './Switch';
import { InvestmentPlan, InvestmentPlanPayload, ProfitType } from '../types';
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

const DURATION_PRESETS = [30, 90, 180, 365];

const EMPTY_FORM = {
  name: '',
  description: '',
  minAmount: '',
  maxAmount: '',
  durationDays: '90',
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
        durationDays: String(plan.durationDays ?? 90),
        profitValue: String(plan.profitValue ?? ''),
        sortOrder: String(plan.sortOrder ?? 0),
        featuredTagline: plan.featuredTagline || '',
      });
      setProfitType(plan.profitType || 'PERCENTAGE');
      setIsActive(plan.isActive ?? true);
      setIsFeatured(Boolean(plan.isFeatured));
    } else {
      setForm(EMPTY_FORM);
      setProfitType('PERCENTAGE');
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
  const hasExample =
    form.minAmount !== '' &&
    form.profitValue !== '' &&
    Number.isFinite(exampleAmount) &&
    exampleAmount > 0 &&
    Number.isFinite(exampleProfitValue) &&
    exampleProfitValue > 0 &&
    Number.isInteger(exampleDays) &&
    exampleDays >= 1;
  const exampleProfit =
    profitType === 'PERCENTAGE' ? Math.round(exampleAmount * exampleProfitValue) / 100 : exampleProfitValue;

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

    if (!/^\d+$/.test(form.durationDays.trim()) || Number(form.durationDays) < 1) {
      next.durationDays = 'Enter a whole number of days (at least 1)';
    } else if (Number(form.durationDays) > 3650) {
      next.durationDays = 'Period cannot exceed 3650 days';
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
      profitType,
      profitValue: Number(form.profitValue),
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
      subtitle="Investment limits, period and profit"
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

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor={`${formId}-days`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Investment period (days) <span className="text-rose-500">*</span>
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
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <input
            id={`${formId}-days`}
            type="number"
            step="1"
            min="1"
            max="3650"
            inputMode="numeric"
            value={form.durationDays}
            onChange={update('durationDays')}
            placeholder="90"
            className={inputClass}
          />
          {errors.durationDays && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1" role="alert">
              {errors.durationDays}
            </p>
          )}
        </div>

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
            label={profitType === 'PERCENTAGE' ? 'Profit percentage' : 'Fixed profit amount'}
            htmlFor={`${formId}-profit`}
            required
            error={errors.profitValue}
            hint={
              profitType === 'PERCENTAGE'
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
              Investing <strong className="text-slate-900 dark:text-white">{formatINR(exampleAmount)}</strong> returns{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(exampleAmount + exampleProfit)}</strong>{' '}
              after <strong className="text-slate-900 dark:text-white">{exampleDays} days</strong>{' '}
              <span className="text-slate-500 dark:text-slate-400">({formatINR(exampleProfit)} profit)</span>
            </p>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">
              Enter the minimum investment, period and profit to preview the maturity amount.
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
