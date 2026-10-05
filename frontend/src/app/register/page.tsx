"use client";

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, LogIn, AlertCircle, Sun, Moon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { RequiredMark, Spinner } from '@/components/ui/primitives';
import { api, getErrorMessage } from '@/lib/api';
import { validateNewPassword } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

const fieldClass =
  'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/20 aria-invalid:border-rose-500/60 transition disabled:opacity-60';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-xs text-zinc-500">Loading registration...</div>}>
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
  const [referralNumber, setReferralNumber] = useState(
    () => searchParams.get('ref') || searchParams.get('sponsor') || ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<'name' | 'email' | 'phone' | 'password' | null>(null);

  const fail = (field: 'name' | 'email' | 'phone' | 'password', message: string) => {
    setInvalidField(field);
    setError(message);
  };

  const handleRegister = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setInvalidField(null);

    // Pre-flight validation matching the backend rules
    if (name.trim().length < 2) {
      fail('name', 'Full name must be at least 2 characters long.');
      return;
    }

    const cleanEmail = email.trim();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      fail('email', 'Enter a valid email address.');
      return;
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    if (!PHONE_PATTERN.test(cleanPhone)) {
      fail('phone', 'Enter a valid mobile number (10 to 15 digits, optionally starting with +).');
      return;
    }

    const passwordProblem = validateNewPassword(password);
    if (passwordProblem) {
      fail('password', passwordProblem);
      return;
    }

    setLoading(true);

    try {
      await api.register({
        name,
        email: cleanEmail,
        phone: cleanPhone,
        password,
        referralNumber: referralNumber.trim() || null,
      });

      router.push(`/login?registered=true&email=${encodeURIComponent(cleanEmail)}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to create your account. Please try again.'));
      setLoading(false);
    }
  };

  const themeLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between items-center p-4 py-8 sm:py-12 transition-colors duration-200 relative">

      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-5xl flex items-center justify-between px-2 sm:px-4 mb-4">
        <Logo size="sm" />

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 transition flex items-center gap-1.5 text-xs"
          title={themeLabel}
          aria-label={themeLabel}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
          <span className="hidden sm:inline text-[11px] font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-sm my-auto">
        <div className="p-7 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200/90 dark:border-white/[0.08] shadow-xl backdrop-blur-md transition-colors duration-200">

          {/* Segmented Sign In / Register Tabs */}
          <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.06] rounded-xl text-xs mb-6">
            <Link
              href="/login"
              className="py-1.5 rounded-lg font-medium text-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            >
              Sign In
            </Link>
            <span
              aria-current="page"
              className="py-1.5 rounded-lg font-semibold text-center bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs transition"
            >
              Register
            </span>
          </div>

          <div className="mb-5">
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight">Create your account</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Add money to your wallet by UPI and invest in fixed-term stock market plans.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-3.5" noValidate>
            <div>
              <label htmlFor="register-name" className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span>Full name<RequiredMark /></span>
                <span className="text-[10px] text-zinc-400 font-normal">At least 2 characters</span>
              </label>
              <input
                id="register-name"
                type="text"
                required
                autoComplete="name"
                maxLength={255}
                placeholder="Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                aria-invalid={invalidField === 'name'}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="register-email" className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span>Email address<RequiredMark /></span>
                <span className="text-[10px] text-zinc-400 font-normal">Used to sign in</span>
              </label>
              <input
                id="register-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                aria-invalid={invalidField === 'email'}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="register-phone" className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span>Mobile number<RequiredMark /></span>
                <span className="text-[10px] text-zinc-400 font-normal">10 to 15 digits</span>
              </label>
              <input
                id="register-phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                aria-invalid={invalidField === 'phone'}
                className={`${fieldClass} font-mono`}
              />
            </div>

            <div>
              <label htmlFor="register-password" className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span>Password<RequiredMark /></span>
                <span className="text-[10px] text-zinc-400 font-normal">Min 8 characters, a letter and a digit</span>
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={100}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  aria-invalid={invalidField === 'password'}
                  aria-describedby="register-password-help"
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p id="register-password-help" className="text-[10px] text-zinc-500 mt-1">
                Use at least 8 characters with at least one letter and one digit.
              </p>
            </div>

            <div>
              <label htmlFor="register-referral" className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span>Referral code</span>
                <span className="text-[10px] text-zinc-400 font-normal">Optional</span>
              </label>
              <input
                id="register-referral"
                type="text"
                autoComplete="off"
                maxLength={32}
                placeholder="e.g. RAHU1001"
                value={referralNumber}
                onChange={(e) => setReferralNumber(e.target.value.toUpperCase())}
                disabled={loading}
                className={`${fieldClass} uppercase font-mono`}
              />
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 text-xs font-semibold transition active:scale-98 shadow-sm flex items-center justify-center gap-1.5 mt-2"
            >
              {loading && <Spinner />}
              <span>{loading ? 'Creating account...' : 'Create account'}</span>
              {!loading && <ArrowRight className="w-3 h-3" />}
            </button>

            <p className="text-[10px] text-zinc-500 leading-relaxed text-center">
              Investments carry risk. Profit figures are expected amounts as per each plan&apos;s terms.
            </p>
          </form>

          {/* Clean Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-white dark:bg-[#121215] px-2 text-zinc-400 dark:text-zinc-500 font-medium">
                Already registered?
              </span>
            </div>
          </div>

          {/* Prominent Sign In Button */}
          <Link
            href="/login"
            className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white font-semibold text-xs text-center transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Sign in to an existing account</span>
          </Link>

        </div>
      </div>

      {/* Footer Navigation Back Link */}
      <div className="mt-8 text-center text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition">
          ← Back to MoonTech Home
        </Link>
      </div>

    </div>
  );
}
