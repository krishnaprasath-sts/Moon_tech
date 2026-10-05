"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/primitives';
import { api, getErrorMessage } from '@/lib/api';
import { validateNewPassword } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

const fieldClass =
  'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/20 transition disabled:opacity-60';

const submitClass =
  'w-full py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 text-xs font-semibold transition active:scale-98 shadow-sm flex items-center justify-center gap-1 mt-2';

function isValidIdentifier(value: string): boolean {
  const clean = value.trim();
  if (clean.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  return /^[0-9+ -]{10,15}$/.test(clean);
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const requestCode = async () => {
    if (loading) return;
    setError('');
    setNotice('');

    if (!isValidIdentifier(identifier)) {
      setError('Enter the email address or mobile number registered on your account.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.forgotPassword(identifier);
      setExpiresInMinutes(result.expiresInMinutes);
      setOtp('');
      setStep('reset');
      setNotice(
        `If an account exists for ${identifier.trim()}, a 6-digit code has been sent to its registered email. The code is valid for ${result.expiresInMinutes} minutes.`
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to send the reset code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    void requestCode();
  };

  const handleReset = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    const passwordProblem = validateNewPassword(newPassword);
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(identifier, otp, newPassword);
      const prefill = identifier.includes('@') ? `&email=${encodeURIComponent(identifier.trim())}` : '';
      router.push(`/login?reset=true${prefill}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to reset your password. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between items-center p-4 py-8 sm:py-12 transition-colors duration-200 relative">

      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-5xl flex items-center justify-between px-2 sm:px-4 mb-4">
        <Logo size="sm" />

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 transition flex items-center gap-1.5 text-xs"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
          <span className="hidden sm:inline text-[11px] font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      <div className="w-full max-w-sm my-auto">
        <div className="p-7 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200/90 dark:border-white/[0.08] shadow-xl backdrop-blur-md transition-colors duration-200">

          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Step {step === 'request' ? '1' : '2'} of 2
            </p>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight mt-1">
              {step === 'request' ? 'Forgot your password?' : 'Set a new password'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {step === 'request'
                ? 'Enter your registered email or mobile number and we will email you a reset code.'
                : 'Enter the code we emailed you and choose a new password.'}
            </p>
          </div>

          {notice && (
            <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="leading-relaxed">{notice}</span>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-4" noValidate>
              <div>
                <label htmlFor="identifier" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Email Address or Mobile
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="name@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  className={fieldClass}
                />
              </div>

              <button type="submit" disabled={loading} className={submitClass}>
                {loading && <Spinner />}
                <span>{loading ? 'Sending code...' : 'Send reset code'}</span>
                {!loading && <ArrowRight className="w-3 h-3" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4" noValidate>
              <div>
                <label htmlFor="otp" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  6-digit code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  className={`${fieldClass} font-mono tracking-[0.4em] text-sm`}
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">Valid for {expiresInMinutes} minutes.</p>
              </div>

              <div>
                <label htmlFor="new-password" className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  <span>New password</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Min 8, a letter and a digit</span>
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    className={`${fieldClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className={`${fieldClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className={submitClass}>
                {loading && <Spinner />}
                <span>{loading ? 'Resetting password...' : 'Reset password'}</span>
                {!loading && <ArrowRight className="w-3 h-3" />}
              </button>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError('');
                    setNotice('');
                    setStep('request');
                  }}
                  className="hover:text-zinc-800 dark:hover:text-white transition disabled:opacity-50"
                >
                  Use a different email or mobile
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void requestCode()}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-white/[0.08] text-center text-xs text-zinc-500">
            Remembered your password?{' '}
            <Link href="/login" className="font-semibold text-zinc-800 dark:text-zinc-200 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition">
          ← Back to MoonTech Home
        </Link>
      </div>
    </div>
  );
}
