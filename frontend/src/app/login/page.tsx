"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, UserPlus, CheckCircle2, AlertCircle, Sun, Moon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/primitives';
import { api, getErrorMessage, safeRedirectPath } from '@/lib/api';
import { notifyAuthChange, useAuth, useStoredItem, writeStoredItem } from '@/lib/useAuth';
import { useTheme } from '@/context/ThemeContext';

const SAVED_EMAIL_KEY = 'moontech-saved-email';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-xs text-zinc-500">Loading sign in...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const { token, loading: authLoading } = useAuth({ required: false });

  // Hydration-safe: the remembered email is read through useSyncExternalStore, never during SSR
  const savedEmail = useStoredItem(SAVED_EMAIL_KEY);
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const email = emailInput ?? (searchParams.get('email') || savedEmail || '');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const justRegistered = searchParams.get('registered') === 'true';
  const justReset = searchParams.get('reset') === 'true';
  const destination = safeRedirectPath(searchParams.get('redirect'));

  // A signed-in visitor (or a just-completed login) goes straight to the destination
  useEffect(() => {
    if (!authLoading && token) router.replace(destination);
  }, [authLoading, token, destination, router]);

  const handleLogin = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter your email or mobile number and your password.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(cleanEmail, password);

      if (!data.success || !data.data?.accessToken || !data.data.user) {
        throw new Error(data.message || 'Invalid email or password.');
      }

      writeStoredItem(SAVED_EMAIL_KEY, rememberMe ? cleanEmail : null);
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      notifyAuthChange();
      // Navigation happens in the effect above once the session is visible; keep the button busy meanwhile
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to sign in. Please check your details and try again.'));
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
            <span
              aria-current="page"
              className="py-1.5 rounded-lg font-semibold text-center bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs transition"
            >
              Sign In
            </span>
            <Link
              href="/register"
              className="py-1.5 rounded-lg font-medium text-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            >
              Register
            </Link>
          </div>

          <div className="mb-5">
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight">Welcome back</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Sign in to access your wallet and investments.
            </p>
          </div>

          {/* Success Banner when arriving from Register page */}
          {justRegistered && (
            <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Account created successfully. Please sign in.</span>
            </div>
          )}

          {justReset && !justRegistered && (
            <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Password updated. Please sign in with your new password.</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Email address or mobile
              </label>
              <input
                id="login-email"
                type="text"
                required
                autoComplete="username"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={loading}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/20 transition disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="login-password" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Password</label>
                <Link href="/forgot-password" className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/20 transition pr-10 disabled:opacity-60"
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

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  className="rounded border-zinc-300 dark:border-white/10 text-blue-600 focus:ring-0"
                />
                <span>Remember my email on this device</span>
              </label>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 text-xs font-semibold transition active:scale-98 shadow-sm flex items-center justify-center gap-1.5 mt-2"
            >
              {loading && <Spinner />}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              {!loading && <ArrowRight className="w-3 h-3" />}
            </button>
          </form>

          {/* Clean Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-white dark:bg-[#121215] px-2 text-zinc-400 dark:text-zinc-500 font-medium">
                Don&apos;t have an account?
              </span>
            </div>
          </div>

          {/* Prominent New Register Button */}
          <Link
            href="/register"
            className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white font-semibold text-xs text-center transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Create a new account</span>
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
