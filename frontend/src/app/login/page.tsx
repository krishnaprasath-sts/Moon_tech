"use client";

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  X,
  Wrench,
  Sun,
  Moon,
  Mail,
  Lock,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
  MailCheck,
  RefreshCw,
  KeyRound,
  Wallet,
  Landmark,
  LockKeyhole,
  BadgeIndianRupee,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/primitives';
import { api, ApiError, clearFirstLoginPass, getErrorMessage, isOtpChallenge, LoginInfo, LoginOtpChallenge, LoginSession, safeRedirectPath } from '@/lib/api';
import { notifyAuthChange, useAuth, useStoredItem, writeStoredItem } from '@/lib/useAuth';
import { useTheme } from '@/context/ThemeContext';

const SAVED_EMAIL_KEY = 'moontech-saved-email';
const OTP_LENGTH = 6;

const INPUT_CLASS =
  'w-full bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/[0.1] rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-60';

const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-xs text-zinc-500">
          Loading sign in...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const { token, loading: authLoading } = useAuth({ required: false });

  // Hydration-safe remembered email
  const savedEmail = useStoredItem(SAVED_EMAIL_KEY);
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const email = emailInput ?? (searchParams.get('email') || savedEmail || '');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2: the emailed code
  const [challenge, setChallenge] = useState<LoginOtpChallenge | null>(null);
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState('');
  // Set when sign-in is refused because the email address was never verified
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendingLink, setResendingLink] = useState(false);
  // Announcement and maintenance state from the admin settings, read before anyone signs in
  const [loginInfo, setLoginInfo] = useState<LoginInfo | null>(null);
  const maintenance = Boolean(loginInfo?.maintenanceMode);
  // The latest announcement opens as a popup once per browser session (per announcement text)
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const announcementKey = loginInfo?.loginAnnouncement
    ? `login-announcement-seen:${loginInfo.loginAnnouncementTitle}|${loginInfo.loginAnnouncement}`
    : null;
  const dismissAnnouncement = () => {
    setAnnouncementOpen(false);
    if (!announcementKey) return;
    try {
      sessionStorage.setItem(announcementKey, '1');
    } catch {
      // ignore
    }
  };
  const otpInputRef = useRef<HTMLInputElement>(null);
  const challengeStartedAt = useRef(0);

  const justRegistered = searchParams.get('registered') === 'true';
  const justReset = searchParams.get('reset') === 'true';
  const destination = safeRedirectPath(searchParams.get('redirect'));

  // Signed-in users go straight to destination
  useEffect(() => {
    if (!authLoading && token) {
      router.replace(destination);
    }
  }, [authLoading, token, destination, router]);

  useEffect(() => {
    let cancelled = false;
    api
      .getLoginInfo()
      .then((info) => {
        if (cancelled) return;
        setLoginInfo(info);
        // Open the popup unless this exact announcement was already dismissed in this browser session
        if (info.loginAnnouncement) {
          let seen = false;
          try {
            seen = Boolean(sessionStorage.getItem(`login-announcement-seen:${info.loginAnnouncementTitle}|${info.loginAnnouncement}`));
          } catch {
            seen = false;
          }
          if (!seen) setAnnouncementOpen(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Expiry and resend countdowns, derived from the server's timestamps
  useEffect(() => {
    if (!challenge) return undefined;
    const expiresAt = new Date(challenge.expiresAt).getTime();
    const tick = () => {
      const now = Date.now();
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - now) / 1000)));
      setResendIn(Math.max(0, Math.ceil((challengeStartedAt.current + challenge.resendAfterSeconds * 1000 - now) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const startChallenge = (next: LoginOtpChallenge) => {
    challengeStartedAt.current = Date.now();
    setChallenge(next);
    setOtp('');
    setError('');
    window.setTimeout(() => otpInputRef.current?.focus(), 50);
  };

  const storeSession = (session: LoginSession, cleanEmail: string) => {
    clearFirstLoginPass();
    writeStoredItem(SAVED_EMAIL_KEY, rememberMe ? cleanEmail : null);
    localStorage.setItem('accessToken', session.accessToken);
    localStorage.setItem('user', JSON.stringify(session.user));
    notifyAuthChange();
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');

    if (maintenance) {
      setError(loginInfo?.maintenanceMessage || 'Sign in is paused for maintenance. Please try again shortly.');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter your email or mobile number and your password.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(cleanEmail, password);
      if (!data.success || !data.data) {
        throw new Error(data.message || 'Invalid email or password.');
      }

      if (isOtpChallenge(data.data)) {
        // Correct password: the session is issued once the emailed code is verified
        startChallenge(data.data);
        setNotice(data.message || `A 6-digit code has been sent to ${data.data.email}.`);
        setLoading(false);
        return;
      }

      if (!data.data.accessToken || !data.data.user) {
        throw new Error(data.message || 'Invalid email or password.');
      }
      storeSession(data.data, cleanEmail);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to sign in. Please check your credentials and try again.'));
      const notVerified = err instanceof ApiError && err.errors.some((e) => e.field === 'emailVerification');
      setUnverifiedEmail(notVerified ? cleanEmail : null);
      setLoading(false);
    }
  };

  const resendVerificationLink = async () => {
    if (!unverifiedEmail || resendingLink) return;
    setResendingLink(true);
    setError('');
    try {
      const message = await api.resendVerification(unverifiedEmail);
      setNotice(message);
      setUnverifiedEmail(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to send a new link. Please try again.'));
    } finally {
      setResendingLink(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (loading || !challenge) return;
    setError('');
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      otpInputRef.current?.focus();
      return;
    }
    if (secondsLeft <= 0) {
      setError('This code has expired. Tap "Send a new code" to get another one.');
      return;
    }

    setLoading(true);
    try {
      const session = await api.verifyLoginOtp(challenge.challengeId, code);
      storeSession(session, email.trim());
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'The code could not be verified. Please try again.');
      setError(message);
      setLoading(false);
      // A dead challenge sends the user back to the password step
      if (/sign in again/i.test(message)) {
        setChallenge(null);
        setPassword('');
      } else {
        setOtp('');
        otpInputRef.current?.focus();
      }
    }
  };

  const handleResend = async () => {
    if (!challenge || resending || resendIn > 0) return;
    setResending(true);
    setError('');
    try {
      const next = await api.resendLoginOtp(challenge.challengeId);
      startChallenge(next);
      setNotice(next.message || `A new code has been sent to ${next.email}.`);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Unable to send a new code. Please try again.');
      setError(message);
      if (/sign in again/i.test(message)) {
        setChallenge(null);
        setPassword('');
      }
    } finally {
      setResending(false);
    }
  };

  const backToPassword = () => {
    setChallenge(null);
    setOtp('');
    setError('');
    setNotice('');
    setPassword('');
  };

  const themeLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  const expired = Boolean(challenge) && secondsLeft <= 0;

  const announcementPopup =
    announcementOpen && loginInfo?.loginAnnouncement ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
        role="presentation"
        onClick={dismissAnnouncement}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-announcement-title"
          className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 bg-blue-600 text-white flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Megaphone className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-blue-100">Announcement</p>
                <h2 id="login-announcement-title" className="text-sm font-bold break-words">
                  {loginInfo.loginAnnouncementTitle || 'A message from Clyvus Ventures'}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissAnnouncement}
              aria-label="Close announcement"
              className="p-1 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-4 text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed max-h-[50vh] overflow-y-auto">
            {loginInfo.loginAnnouncement}
          </div>
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={dismissAnnouncement}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 transition-colors duration-200 relative overflow-hidden">
      {announcementPopup}
      {/* Dynamic Ambient Background Glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] rounded-full blur-[140px] opacity-25 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, #2563eb 0%, #4f46e5 50%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[350px] rounded-full blur-[120px] opacity-15 dark:opacity-10"
        style={{
          background: 'radial-gradient(circle, #06b6d4 0%, #3b82f6 60%, transparent 80%)',
        }}
      />

      {/* Top Header */}
      <header className="vt-auth-header w-full max-w-5xl flex items-center justify-between px-2 sm:px-4 mb-6 z-10">
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

          {/* Left Column: what signing in gives you */}
          <aside className="hidden md:flex md:col-span-5 p-8 lg:p-10 flex-col justify-between relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50/60 to-cyan-50/70 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-cyan-950/20 border-r border-zinc-200/70 dark:border-white/[0.06]">
            {/* Glow orbs */}
            <div className="absolute -top-16 -left-10 w-56 h-56 bg-blue-500/15 dark:bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-10 w-56 h-56 bg-cyan-500/15 dark:bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 text-blue-700 dark:text-blue-400 text-[11px] font-semibold mb-5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Member sign in</span>
              </div>

              <h2 className="text-2xl lg:text-[26px] font-extrabold text-zinc-950 dark:text-white tracking-tight leading-snug">
                Your money, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-300">
                  working every working day.
                </span>
              </h2>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-3 leading-relaxed">
                Sign in to see today&apos;s profit credit, add money by bank transfer, and withdraw your profit whenever you
                like.
              </p>

              {/* What you can do */}
              <ul className="mt-5 space-y-3">
                {[
                  { icon: Wallet, title: 'Add money by bank transfer', text: 'NEFT, IMPS or RTGS to the company account, verified by our team.' },
                  { icon: TrendingUp, title: 'Track every credit', text: 'See each day\'s profit, your running total and what is due next.' },
                  { icon: Landmark, title: 'Withdraw to your bank', text: 'Profit any time, capital whenever you need it, paid to your verified bank account.' },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">{item.title}</h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Security row */}
            <div className="relative mt-8 pt-5 border-t border-zinc-200/70 dark:border-white/[0.06]">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <MailCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">Two-step sign in</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                    After your password we email a 6-digit code valid for 2 minutes, so only you can open your account.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-zinc-600 dark:text-zinc-400">
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
                  <span>Bank-to-bank only</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Column: Sign In Form */}
          <div className="md:col-span-7 p-5 sm:p-8 lg:p-10 flex flex-col justify-between min-w-0">
            <div>
              {/* Segmented Sign In / Register Tabs */}
              <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/[0.07] rounded-xl text-xs mb-6">
                <span
                  aria-current="page"
                  className="vt-auth-tab py-2 rounded-lg font-bold text-center bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs transition"
                >
                  Sign In
                </span>
                <Link
                  href="/register"
                  className="py-2 rounded-lg font-medium text-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
                >
                  Create Account
                </Link>
              </div>

              {challenge ? (
                /* ------------------------------------------------ Step 2: email code */
                <div>
                  <div className="mb-5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                      <MailCheck className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">Check your email</h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      We sent a 6-digit code to <span className="font-semibold text-zinc-800 dark:text-zinc-200">{challenge.email}</span>.
                      Enter it below to finish signing in.
                    </p>
                  </div>

                  {notice && !error && (
                    <div
                      role="status"
                      className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-fade-in"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{notice}</span>
                    </div>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-fade-in"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {challenge.devOtp && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                      Local development, no mailbox configured. Your code is <span className="font-mono font-bold">{challenge.devOtp}</span>.
                    </div>
                  )}

                  <form onSubmit={handleVerify} className="space-y-4" noValidate>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="login-otp" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Verification code
                        </label>
                        <span
                          className={`text-[11px] font-semibold tabular-nums inline-flex items-center gap-1 ${
                            expired ? 'text-rose-600 dark:text-rose-400' : secondsLeft <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'
                          }`}
                          aria-live="polite"
                        >
                          <Clock className="w-3 h-3" />
                          {expired ? 'Code expired' : `Expires in ${formatCountdown(secondsLeft)}`}
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <input
                          ref={otpInputRef}
                          id="login-otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]*"
                          maxLength={OTP_LENGTH}
                          placeholder="••••••"
                          value={otp}
                          onChange={(e) => {
                            setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
                            setError('');
                          }}
                          disabled={loading || expired}
                          aria-invalid={Boolean(error)}
                          className={`${INPUT_CLASS} pl-10 pr-3.5 py-3 font-mono text-base tracking-[0.5em]`}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1.5">
                        The code is valid for {Math.round(challenge.expiresInSeconds / 60)} minutes. Check your spam folder if it has not arrived.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || expired || otp.length !== OTP_LENGTH}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all active:scale-[0.99] shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading && <Spinner />}
                      <span>{loading ? 'Verifying...' : 'Verify and sign in'}</span>
                      {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </form>

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || resendIn > 0 || loading}
                      className="inline-flex items-center justify-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resending ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>{resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={backToPassword}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Use a different account</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ------------------------------------------------ Step 1: password */
                <div>
                  {/* Headline */}
                  <div className="mb-6">
                    <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">Welcome back</h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Sign in to manage your wallet, plans and daily credits.
                    </p>
                  </div>

                  {/* Success Notification: Arriving from Register */}
                  {justRegistered && (
                    <div
                      role="status"
                      className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-fade-in"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <span className="font-semibold">Account created! One more step.</span>
                        <p className="text-[11px] opacity-90">
                          We emailed a verification link to {email || 'your address'}. Click it to activate your account, then sign in here.
                          Check the spam folder if it does not arrive within a minute.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Success Notification: Arriving from Password Reset */}
                  {justReset && !justRegistered && (
                    <div
                      role="status"
                      className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-fade-in"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <span className="font-semibold">Password updated successfully!</span>
                        <p className="text-[11px] opacity-90">Please sign in with your new password.</p>
                      </div>
                    </div>
                  )}

                  {/* Announcement from the admin: a short reminder line; the full text opens as a popup */}
                  {loginInfo?.loginAnnouncement && !announcementOpen && (
                    <button
                      type="button"
                      onClick={() => setAnnouncementOpen(true)}
                      className="mb-5 w-full text-left p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2.5 hover:bg-blue-500/15 transition"
                    >
                      <Megaphone className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold truncate">{loginInfo.loginAnnouncementTitle || 'Announcement'}</span>
                      <span className="ml-auto text-[11px] underline shrink-0">Read</span>
                    </button>
                  )}

                  {/* Maintenance: sign in and registration are paused */}
                  {maintenance && (
                    <div
                      role="alert"
                      className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5 animate-fade-in"
                    >
                      <Wrench className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <span className="font-semibold">Under maintenance</span>
                        <p className="text-[11px] opacity-90 whitespace-pre-line leading-relaxed">{loginInfo?.maintenanceMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div
                      role="alert"
                      className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-fade-in"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {unverifiedEmail && (
                    <div className="mb-5 -mt-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Did not get the link?</span>
                      <button
                        type="button"
                        onClick={resendVerificationLink}
                        disabled={resendingLink}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                      >
                        {resendingLink ? 'Sending...' : 'Resend verification email'}
                      </button>
                    </div>
                  )}

                  {notice && !challenge && (
                    <div
                      role="status"
                      className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-fade-in"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{notice}</span>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleLogin} className="space-y-4" noValidate>
                    {/* Email / Mobile */}
                    <div>
                      <label htmlFor="login-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Email address or mobile number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="login-email"
                          type="text"
                          required
                          autoComplete="username"
                          placeholder="name@example.com or mobile"
                          value={email}
                          onChange={(e) => setEmailInput(e.target.value)}
                          disabled={loading}
                          className={`${INPUT_CLASS} pl-10 pr-3.5 py-2.5`}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label htmlFor="login-password" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Password
                        </label>
                        <Link href="/forgot-password" className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline transition">
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={loading}
                          className={`${INPUT_CLASS} pl-10 pr-10 py-2.5`}
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
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          disabled={loading}
                          className="rounded border-zinc-300 dark:border-white/10 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <span>Remember my details on this device</span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all active:scale-[0.99] shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-3 cursor-pointer"
                    >
                      {loading && <Spinner />}
                      <span>{loading ? 'Checking...' : 'Continue'}</span>
                      {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1">
                      <MailCheck className="w-3 h-3" />
                      After your password, we email you a 6-digit code that is valid for 2 minutes.
                    </p>
                  </form>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200 dark:border-white/[0.08]" />
                    </div>
                    <div className="relative flex justify-center text-[11px]">
                      <span className="bg-white dark:bg-[#111114] px-3 text-zinc-400 dark:text-zinc-500 font-medium">New to Clyvus Ventures?</span>
                    </div>
                  </div>

                  {/* Register Action */}
                  <Link
                    href="/register"
                    className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white font-semibold text-xs text-center transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Create a free account</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile-only trust footer note */}
            <p className="md:hidden mt-6 text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Secured with 256-bit bank-grade encryption
            </p>
          </div>

        </div>
      </div>

      {/* Footer Navigation Link */}
      <footer className="mt-6 text-center text-xs text-zinc-500 z-10">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition">
          ← Back to Clyvus Ventures Homepage
        </Link>
      </footer>
    </div>
  );
}
