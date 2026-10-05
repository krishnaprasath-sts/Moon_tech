import React, { useState, useEffect, useId } from 'react';
import { UserPlus, Sparkles, Loader2, Eye, EyeOff } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useCreateCustomer } from '../hooks';
import { useToast } from '../context/ToastContext';
import { Field, FormError, inputClass, btnGhostClass, btnPrimaryClass } from './ui';
import { getApiErrorMessage } from '../utils/finance';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  referralNumber: '',
  dateOfBirth: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
};

type FormState = typeof EMPTY_FORM;
type FormErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

// Random password that satisfies the "min 8, one letter, one digit" rule
const generatePassword = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string, count: number) =>
    Array.from(crypto.getRandomValues(new Uint32Array(count)), (v) => set[v % set.length]).join('');
  return `${pick(letters, 6)}${pick(digits, 4)}`;
};

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const formId = useId();

  const { mutateAsync: createCustomer, isPending } = useCreateCustomer();
  const { toast } = useToast();

  // Reset the form every time the dialog opens
  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setErrors({});
      setFormError(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (form.name.trim().length < 2) next.name = "Enter the customer's full name";
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!PHONE_PATTERN.test(form.phone.replace(/[\s-]/g, ''))) next.phone = 'Enter a valid 10-15 digit phone number';
    if (form.password && (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))) {
      next.password = 'Minimum 8 characters with at least one letter and one digit';
    }
    if (form.pincode.trim() && !PINCODE_PATTERN.test(form.pincode.trim())) next.pincode = 'Pincode must be 6 digits';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setFormError(null);
    if (!validate()) return;

    try {
      await createCustomer({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/[\s-]/g, ''),
        password: form.password || undefined,
        referralNumber: form.referralNumber.trim().toUpperCase() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
      });

      toast.success(`Customer "${form.name.trim()}" has been registered`, 'Customer created');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to create the customer account');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Add Customer"
      subtitle="Register a customer account on their behalf"
      icon={UserPlus}
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
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Register Customer
              </>
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormError message={formError} />

        <div>
          <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
            Contact details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Full name" htmlFor={`${formId}-name`} required error={errors.name}>
              <input
                id={`${formId}-name`}
                type="text"
                value={form.name}
                onChange={update('name')}
                placeholder="e.g. Ramesh Chandra"
                autoComplete="off"
                className={inputClass}
              />
            </Field>

            <Field label="Email address" htmlFor={`${formId}-email`} required error={errors.email}>
              <input
                id={`${formId}-email`}
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="customer@example.com"
                autoComplete="off"
                className={inputClass}
              />
            </Field>

            <Field label="Phone number" htmlFor={`${formId}-phone`} required error={errors.phone}>
              <input
                id={`${formId}-phone`}
                type="tel"
                value={form.phone}
                onChange={update('phone')}
                placeholder="+919876543210"
                autoComplete="off"
                className={`${inputClass} font-mono`}
              />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={`${formId}-password`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Initial password <span className="text-slate-400 font-medium">(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, password: generatePassword() }));
                    setErrors((prev) => ({ ...prev, password: undefined }));
                    setShowPassword(true);
                  }}
                  className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate
                </button>
              </div>
              <div className="relative">
                <input
                  id={`${formId}-password`}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={update('password')}
                  placeholder="Leave blank to let the system assign one"
                  autoComplete="new-password"
                  className={`${inputClass} font-mono pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1" role="alert">
                  {errors.password}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">Share it with the customer securely; they can change it later.</p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
            Referral & profile
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Referred by (referral code)" htmlFor={`${formId}-referral`} optional>
              <input
                id={`${formId}-referral`}
                type="text"
                value={form.referralNumber}
                onChange={update('referralNumber')}
                placeholder="e.g. RAHU1001"
                className={`${inputClass} uppercase font-mono`}
              />
            </Field>

            <Field label="Date of birth" htmlFor={`${formId}-dob`} optional>
              <input
                id={`${formId}-dob`}
                type="date"
                value={form.dateOfBirth}
                max={new Date().toISOString().slice(0, 10)}
                onChange={update('dateOfBirth')}
                className={inputClass}
              />
            </Field>

            <Field label="City" htmlFor={`${formId}-city`} optional>
              <input
                id={`${formId}-city`}
                type="text"
                value={form.city}
                onChange={update('city')}
                placeholder="e.g. Mumbai"
                className={inputClass}
              />
            </Field>

            <Field label="State" htmlFor={`${formId}-state`} optional>
              <input
                id={`${formId}-state`}
                type="text"
                value={form.state}
                onChange={update('state')}
                placeholder="e.g. Maharashtra"
                className={inputClass}
              />
            </Field>

            <Field label="Address" htmlFor={`${formId}-address`} optional className="sm:col-span-2">
              <input
                id={`${formId}-address`}
                type="text"
                value={form.address}
                onChange={update('address')}
                placeholder="Street / building address"
                className={inputClass}
              />
            </Field>

            <Field label="Pincode" htmlFor={`${formId}-pincode`} optional error={errors.pincode}>
              <input
                id={`${formId}-pincode`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={update('pincode')}
                placeholder="6 digits"
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
