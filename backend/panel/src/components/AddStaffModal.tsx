import React, { useState, useEffect, useId } from 'react';
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useCreateStaff } from '../hooks/useStaff';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../types';
import { Field, FormError, inputClass, btnGhostClass, btnPrimaryClass, labelClass, RequiredMark } from './ui';
import { getApiErrorMessage } from '../utils/finance';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

export const ROLE_OPTIONS: Array<{ role: UserRole; label: string; description: string; activeClass: string }> = [
  {
    role: UserRole.SUPER_ADMIN,
    label: 'Super Admin',
    description: 'Everything, including staff and settings',
    activeClass: 'bg-violet-50 dark:bg-violet-500/10 border-violet-500 text-violet-700 dark:text-violet-300',
  },
  {
    role: UserRole.ADMIN,
    label: 'Admin',
    description: 'Approve payments, withdrawals, KYC and plans',
    activeClass: 'bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-300',
  },
  {
    role: UserRole.EDITOR,
    label: 'Editor',
    description: 'View-only access to every screen',
    activeClass: 'bg-sky-50 dark:bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-300',
  },
];

export const AddStaffModal: React.FC<AddStaffModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const formId = useId();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN);
  const [errors, setErrors] = useState<{ email?: string; phone?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { mutateAsync: createStaff, isPending } = useCreateStaff();
  const { toast } = useToast();

  // Reset the form every time the dialog opens
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPhone('');
      setPassword('');
      setShowPassword(false);
      setRole(UserRole.ADMIN);
      setErrors({});
      setFormError(null);
    }
  }, [isOpen]);

  const validate = () => {
    const next: typeof errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address';
    if (!PHONE_PATTERN.test(phone.replace(/[\s-]/g, ''))) next.phone = 'Enter a valid 10-15 digit phone number';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      next.password = 'Minimum 8 characters with at least one letter and one digit';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setFormError(null);
    if (!validate()) return;

    try {
      await createStaff({
        email: email.trim().toLowerCase(),
        phone: phone.replace(/[\s-]/g, ''),
        password,
        role,
      });
      toast.success(`${email.trim()} can now sign in as ${role.replace('_', ' ')}`, 'Staff account created');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to create the staff account');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Add Staff Member"
      subtitle="Create an admin panel account with a role"
      icon={UserPlus}
      maxWidthClass="max-w-lg"
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
                Create Staff Member
              </>
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError message={formError} />

        <Field label="Email address" htmlFor={`${formId}-email`} required error={errors.email}>
          <input
            id={`${formId}-email`}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="staff@example.com"
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Field label="Phone number" htmlFor={`${formId}-phone`} required error={errors.phone}>
          <input
            id={`${formId}-phone`}
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            placeholder="+919876543210"
            autoComplete="off"
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field
          label="Initial password"
          htmlFor={`${formId}-password`}
          required
          error={errors.password}
          hint="Minimum 8 characters with at least one letter and one digit. Ask them to change it after first sign-in."
        >
          <div className="relative">
            <input
              id={`${formId}-password`}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Choose a strong password"
              autoComplete="new-password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <div>
          <p className={labelClass}>
            Role
            <RequiredMark />
          </p>
          <div role="radiogroup" aria-label="Role" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((option) => {
              const isSelected = role === option.role;
              return (
                <button
                  key={option.role}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setRole(option.role)}
                  className={`p-3 rounded-xl border text-left transition ${
                    isSelected
                      ? `${option.activeClass} ring-2 ring-offset-1 ring-current/20 dark:ring-offset-slate-900`
                      : 'border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs font-bold">{option.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5 leading-snug">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
