"use client";

import React, { useState, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Eye,
  EyeOff,
  ArrowRight,
  LogIn,
  AlertCircle,
  Sun,
  Moon,
  User,
  Mail,
  Phone,
  Lock,
  Gift,
  Check,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Landmark,
  TrendingUp,
  BadgeIndianRupee,
  LockKeyhole,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/primitives';
import { api, ApiError, getErrorMessage } from '@/lib/api';
import { validateNewPassword } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

// Mirrors backend/node/src/validators/authValidators.ts (registerSchema); the server re-checks everything.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting with 6-9 */
const PHONE_PATTERN = /^(?:\+?91|0)?[6-9][0-9]{9}$/;
const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;
const REFERRAL_PATTERN = /^[A-Z]{4}[0-9]{4}$/;

type FieldName = 'name' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'referralNumber' | 'acceptedTerms';
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_LABELS: Record<FieldName, string> = {
  name: 'Full legal name',
  email: 'Email address',
  phone: 'Mobile number',
  password: 'Password',
  confirmPassword: 'Confirm password',
  referralNumber: 'Referral code',
  acceptedTerms: 'Terms and conditions',
};

const INPUT_CLASS =
  'w-full bg-zinc-50/80 dark:bg-zinc-900/80 border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 transition disabled:opacity-60';
const INPUT_OK = 'border-zinc-200 dark:border-white/[0.1] focus:ring-blue-500/20 focus:border-blue-500';
const INPUT_BAD = 'border-rose-400 dark:border-rose-500/70 focus:ring-rose-500/20 focus:border-rose-500';

const inputClass = (invalid: boolean, extra = '') => `${INPUT_CLASS} ${invalid ? INPUT_BAD : INPUT_OK} ${extra}`;
const labelClass = 'block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';

function SectionTitle({ id, step, title, hint }: { id: string; step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-200/80 dark:border-white/[0.08]">
      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{step}</span>
      <h2 id={id} className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
        {title}
      </h2>
      {hint && <span className="ml-auto text-[10px] text-zinc-400 text-right">{hint}</span>}
    </div>
  );
}

interface FormValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  referralNumber: string;
  acceptedTerms: boolean;
}

/** Client-side checks; returns one message per invalid field */
function validateForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Enter your full name.';
  else if (name.length < 2) errors.name = 'Name must be at least 2 characters.';
  else if (name.length > 100) errors.name = 'Name cannot be longer than 100 characters.';
  else if (!NAME_PATTERN.test(name)) errors.name = 'Use letters only, as printed on your Aadhaar or PAN.';

  const email = values.email.trim();
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > 255 || !EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';

  const phone = values.phone.replace(/[\s-]/g, '');
  if (!phone) errors.phone = 'Enter your mobile number.';
  else if (!PHONE_PATTERN.test(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number (starts with 6-9).';

  if (!values.password) errors.password = 'Create a password.';
  else if (/\s/.test(values.password)) errors.password = 'Password cannot contain spaces.';
  else {
    const problem = validateNewPassword(values.password);
    if (problem) errors.password = problem;
  }

  if (!values.confirmPassword) errors.confirmPassword = 'Type your password again.';
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';

  const referral = values.referralNumber.trim().toUpperCase();
  if (!referral) errors.referralNumber = 'A referral code is required to open an account.';
  else if (!REFERRAL_PATTERN.test(referral)) {
    errors.referralNumber = 'Referral codes are 4 letters followed by 4 digits, e.g. RAHU1001.';
  }

  if (!values.acceptedTerms) errors.acceptedTerms = 'Please accept the terms and conditions to continue.';

  return errors;
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-xs text-zinc-500">
          Loading registration...
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralNumber, setReferralNumber] = useState(
    () => (searchParams.get('ref') || searchParams.get('sponsor') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const clearField = (field: FieldName) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  // 0-4: length, letter, digit, extra credit for 12+ with a symbol; spaces cap it at "weak"
  const passwordScore = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Za-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (password.length >= 12 && /[^A-Za-z0-9]/.test(password)) score += 1;
    return /\s/.test(password) ? Math.min(score, 1) : score;
  }, [password]);

  const confirmMatches = confirmPassword.length > 0 && confirmPassword === password;

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const errors = validateForm({ name, email, phone, password, confirmPassword, referralNumber, acceptedTerms });
    setFieldErrors(errors);
    const invalid = (Object.keys(errors) as FieldName[]).filter((k) => errors[k]);
    if (invalid.length > 0) {
      setError(
        invalid.length === 1
          ? `Please check the ${FIELD_LABELS[invalid[0]].toLowerCase()}.`
          : `Please check ${invalid.length} highlighted fields.`
      );
      document.getElementById(`register-${invalid[0]}`)?.focus();
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/[\s-]/g, '');
    const cleanReferral = referralNumber.trim().toUpperCase();

    setLoading(true);
    try {
      await api.register({
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password,
        confirmPassword,
        referralNumber: cleanReferral,
        acceptedTerms,
      });

      router.push(`/login?registered=true&email=${encodeURIComponent(cleanEmail)}`);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Unable to create your account. Please check your details.');
      // Put server-side messages next to the field they belong to
      const serverErrors: FieldErrors = {};
      if (err instanceof ApiError) {
        for (const fe of err.errors ?? []) {
          const field = fe.field as FieldName;
          if (field in FIELD_LABELS && fe.message && !serverErrors[field]) serverErrors[field] = fe.message;
        }
        const lower = message.toLowerCase();
        if (err.status === 409) {
          if (lower.includes('email')) serverErrors.email = message;
          else if (lower.includes('phone')) serverErrors.phone = message;
        } else if (err.status === 400 && lower.includes('referral code')) {
          serverErrors.referralNumber = message;
        }
      }
      setFieldErrors(serverErrors);
      setError(message);
      setLoading(false);
    }
  };

  const themeLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;

  const fieldMessage = (field: FieldName) =>
    fieldErrors[field] ? (
      <p id={`register-${field}-error`} role="alert" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1">
        <AlertCircle className="w-3 h-3 mt-[1px] shrink-0" />
        <span>{fieldErrors[field]}</span>
      </p>
    ) : null;

  const iconBox = (icon: React.ReactNode) => (
    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">{icon}</div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 transition-colors duration-200 relative overflow-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[500px] rounded-full blur-[140px] opacity-25 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, #4f46e5 0%, #2563eb 50%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-[500px] h-[350px] rounded-full blur-[120px] opacity-15 dark:opacity-10"
        style={{
          background: 'radial-gradient(circle, #059669 0%, #3b82f6 60%, transparent 80%)',
        }}
      />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-center justify-between px-2 sm:px-4 mb-6 z-10">
        <Logo size="md" />

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:inline-flex text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            Explore Platform
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/70 dark:bg-white/[0.05] hover:bg-zinc-100 dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/10 transition flex items-center gap-2 text-xs shadow-xs backdrop-blur-sm"
            title={themeLabel}
            aria-label={themeLabel}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
            <span className="hidden sm:inline text-[11px] font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Main Dual-Side Card Container */}
      <div className="w-full max-w-4xl my-auto z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/90 dark:border-white/[0.09] shadow-2xl overflow-hidden backdrop-blur-xl">

          {/* Left Column: Plans, how it works and trust */}
          <aside className="hidden md:flex md:col-span-5 p-8 lg:p-10 flex-col justify-between relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50/60 to-emerald-50/70 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-emerald-950/20 border-r border-zinc-200/70 dark:border-white/[0.06]">
            {/* Glow orbs */}
            <div className="absolute -top-16 -left-10 w-56 h-56 bg-blue-500/15 dark:bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-10 w-56 h-56 bg-emerald-500/15 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold mb-5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero account opening fee</span>
              </div>

              <h2 className="text-2xl lg:text-[26px] font-extrabold text-zinc-950 dark:text-white tracking-tight leading-snug">
                Monthly profit, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600 dark:from-emerald-400 dark:via-teal-300 dark:to-blue-400">
                  paid every working day.
                </span>
              </h2>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-3 leading-relaxed">
                Open your account in under two minutes. Add money by bank transfer, pick a plan, and your
                profit lands in your wallet every Monday to Friday at 6:00 AM IST.
              </p>

              {/* How it works */}
              <ol className="mt-6 space-y-3">
                {[
                  { icon: UserPlus, title: 'Create your account', text: 'Register with a referral code and complete KYC once.' },
                  { icon: Landmark, title: 'Add money by bank transfer', text: 'NEFT, IMPS or RTGS from your bank app or net banking.' },
                  { icon: TrendingUp, title: 'Pick a plan and earn', text: 'Profit is credited every working day at 6:00 AM. Withdraw it to your bank whenever you like.' },
                ].map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <div className="relative w-8 h-8 rounded-lg bg-white/80 dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                      <step.icon className="w-4 h-4" />
                      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">{step.title}</h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Trust row */}
            <div className="relative mt-8 pt-5 border-t border-zinc-200/70 dark:border-white/[0.06] grid grid-cols-3 gap-2 text-[10px] text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>KYC verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <LockKeyhole className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Encrypted data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeIndianRupee className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Withdraw profit anytime</span>
              </div>
            </div>
          </aside>

          {/* Right Column: Register Form */}
          <div className="md:col-span-7 p-5 sm:p-8 lg:p-10 flex flex-col justify-between min-w-0">
            <div>
              {/* Segmented Sign In / Register Tabs */}
              <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/[0.07] rounded-xl text-xs mb-6">
                <Link
                  href="/login"
                  className="py-2 rounded-lg font-medium text-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
                >
                  Sign In
                </Link>
                <span
                  aria-current="page"
                  className="py-2 rounded-lg font-bold text-center bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs transition"
                >
                  Create Account
                </span>
              </div>

              {/* Headline */}
              <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">Open Your Account</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Takes about two minutes. You will need a referral code from an existing member.</p>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleRegister} className="space-y-5" noValidate>
                {/* 1. Personal details */}
                <section aria-labelledby="register-section-personal" className="space-y-3">
                  <SectionTitle id="register-section-personal" step={1} title="Your details" />

                  <div>
                    <label htmlFor="register-name" className={labelClass}>
                      Full legal name <span className="text-zinc-400 font-normal">(as on Aadhaar / PAN)</span>
                    </label>
                    <div className="relative">
                      {iconBox(<User className="w-4 h-4" />)}
                      <input
                        id="register-name"
                        type="text"
                        required
                        autoComplete="name"
                        maxLength={100}
                        placeholder="Rahul Sharma"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          clearField('name');
                        }}
                        disabled={loading}
                        aria-invalid={Boolean(fieldErrors.name)}
                        aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
                        className={inputClass(Boolean(fieldErrors.name))}
                      />
                    </div>
                    {fieldMessage('name')}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-email" className={labelClass}>
                        Email address
                      </label>
                      <div className="relative">
                        {iconBox(<Mail className="w-4 h-4" />)}
                        <input
                          id="register-email"
                          type="email"
                          required
                          autoComplete="email"
                          maxLength={255}
                          placeholder="rahul@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            clearField('email');
                          }}
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.email)}
                          aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                          className={inputClass(Boolean(fieldErrors.email))}
                        />
                      </div>
                      {fieldMessage('email')}
                    </div>

                    <div>
                      <label htmlFor="register-phone" className={labelClass}>
                        Mobile number
                      </label>
                      <div className="relative">
                        {iconBox(<Phone className="w-4 h-4" />)}
                        <input
                          id="register-phone"
                          type="tel"
                          required
                          autoComplete="tel"
                          inputMode="tel"
                          maxLength={16}
                          placeholder="98765 43210"
                          value={phone}
                          onChange={(e) => {
                            // Only digits, one leading +, spaces and dashes can be typed
                            const raw = e.target.value.replace(/[^0-9+\s-]/g, '');
                            setPhone(raw.replace(/(?!^)\+/g, ''));
                            clearField('phone');
                          }}
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.phone)}
                          aria-describedby={fieldErrors.phone ? 'register-phone-error' : undefined}
                          className={inputClass(Boolean(fieldErrors.phone), 'font-mono')}
                        />
                      </div>
                      {fieldMessage('phone')}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 -mt-1">
                    Sign-in codes are emailed to this address, so use one you check regularly.
                  </p>
                </section>

                {/* 2. Security */}
                <section aria-labelledby="register-section-security" className="space-y-3">
                  <SectionTitle id="register-section-security" step={2} title="Password" hint="8+ characters with a letter and a number" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-password" className={labelClass}>
                        Password
                      </label>
                      <div className="relative">
                        {iconBox(<Lock className="w-4 h-4" />)}
                        <input
                          id="register-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={100}
                          placeholder="Create a password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            clearField('password');
                            clearField('confirmPassword');
                          }}
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.password)}
                          aria-describedby={fieldErrors.password ? 'register-password-error' : 'register-password-strength'}
                          className={inputClass(Boolean(fieldErrors.password), 'pr-10')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldMessage('password')}
                      {/* Compact strength meter */}
                      {password.length > 0 && !fieldErrors.password && (
                        <div id="register-password-strength" className="mt-1.5 flex items-center gap-1.5" aria-live="polite">
                          {[1, 2, 3].map((level) => (
                            <span
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                passwordScore >= level
                                  ? passwordScore >= 3
                                    ? 'bg-emerald-500'
                                    : passwordScore >= 2
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                  : 'bg-zinc-200 dark:bg-zinc-800'
                              }`}
                            />
                          ))}
                          <span className="text-[10px] font-semibold text-zinc-500 w-10 text-right">
                            {passwordScore >= 3 ? 'Strong' : passwordScore >= 2 ? 'Fair' : 'Weak'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="register-confirmPassword" className={labelClass}>
                        Confirm password
                      </label>
                      <div className="relative">
                        {iconBox(<Lock className="w-4 h-4" />)}
                        <input
                          id="register-confirmPassword"
                          type={showConfirm ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          maxLength={100}
                          placeholder="Type it again"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            clearField('confirmPassword');
                          }}
                          disabled={loading}
                          aria-invalid={Boolean(fieldErrors.confirmPassword)}
                          aria-describedby={fieldErrors.confirmPassword ? 'register-confirmPassword-error' : undefined}
                          className={inputClass(Boolean(fieldErrors.confirmPassword), 'pr-10')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition"
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          aria-pressed={showConfirm}
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldMessage('confirmPassword') ||
                        (confirmMatches && (
                          <p className="mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Passwords match
                          </p>
                        ))}
                    </div>
                  </div>
                </section>

                {/* 3. Referral + agreement */}
                <section aria-labelledby="register-section-referral" className="space-y-3">
                  <SectionTitle id="register-section-referral" step={3} title="Referral and agreement" />

                  <div>
                    <label htmlFor="register-referralNumber" className={labelClass}>
                      Referral code
                    </label>
                    <div className="relative">
                      {iconBox(<Gift className="w-4 h-4" />)}
                      <input
                        id="register-referralNumber"
                        type="text"
                        required
                        autoComplete="off"
                        maxLength={8}
                        placeholder="RAHU1001"
                        value={referralNumber}
                        onChange={(e) => {
                          setReferralNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                          clearField('referralNumber');
                        }}
                        disabled={loading}
                        aria-invalid={Boolean(fieldErrors.referralNumber)}
                        aria-describedby={fieldErrors.referralNumber ? 'register-referralNumber-error' : 'register-referralNumber-help'}
                        className={inputClass(Boolean(fieldErrors.referralNumber), 'uppercase font-mono tracking-wider')}
                      />
                    </div>
                    {fieldMessage('referralNumber') || (
                      <p id="register-referralNumber-help" className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Ask the member who introduced you. 4 letters followed by 4 digits.
                      </p>
                    )}
                  </div>

                  <label
                    htmlFor="register-acceptedTerms"
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none text-xs leading-relaxed transition ${
                      fieldErrors.acceptedTerms
                        ? 'border-rose-400 dark:border-rose-500/70 bg-rose-500/5'
                        : acceptedTerms
                        ? 'border-blue-600/40 bg-blue-600/5 dark:bg-blue-600/10'
                        : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                    }`}
                  >
                    <input
                      id="register-acceptedTerms"
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => {
                        setAcceptedTerms(e.target.checked);
                        clearField('acceptedTerms');
                      }}
                      disabled={loading}
                      aria-invalid={Boolean(fieldErrors.acceptedTerms)}
                      aria-describedby={fieldErrors.acceptedTerms ? 'register-acceptedTerms-error' : undefined}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-300 dark:border-white/20 text-blue-600 focus:ring-2 focus:ring-blue-500/30 cursor-pointer shrink-0"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      I am 18 or older and agree to the{' '}
                      <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 underline underline-offset-2">
                        Terms and Conditions
                      </Link>
                      . Plans carry market risk.
                    </span>
                  </label>
                  {fieldMessage('acceptedTerms')}
                </section>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all active:scale-[0.99] shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <Spinner />}
                  <span>{loading ? 'Creating your account...' : 'Create Account'}</span>
                  {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-white/[0.08]" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-white dark:bg-[#111114] px-3 text-zinc-400 dark:text-zinc-500 font-medium">Already a member?</span>
                </div>
              </div>

              {/* Sign In Alternative Action */}
              <Link
                href="/login"
                className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white font-semibold text-xs text-center transition flex items-center justify-center gap-2 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Sign in to an existing account</span>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Footer Navigation Link */}
      <footer className="mt-6 text-center text-xs text-zinc-500 z-10">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition">
          ← Back to MoonTech Homepage
        </Link>
      </footer>
    </div>
  );
}
