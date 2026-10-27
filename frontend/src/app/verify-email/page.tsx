"use client";

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, MailCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/primitives';
import { api, getErrorMessage } from '@/lib/api';

const fieldClass =
  'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/20 transition disabled:opacity-60';

const buttonClass =
  'w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5';

type State = { kind: 'checking' } | { kind: 'done'; message: string } | { kind: 'failed'; message: string };

/** Landing page of the link emailed after registration: activates the account, or lets the visitor request a new link */
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [state, setState] = useState<State>(token ? { kind: 'checking' } : { kind: 'failed', message: 'This link is incomplete. Open the link from your email again, or request a new one below.' });
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .verifyEmail(token)
      .then((result) => {
        if (!cancelled) setState({ kind: 'done', message: result.message });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'failed', message: getErrorMessage(err, 'This verification link could not be used.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const resend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (resending) return;
    setResendError('');
    setResendNotice('');
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setResendError('Enter the email address you registered with.');
      return;
    }
    setResending(true);
    try {
      setResendNotice(await api.resendVerification(clean));
    } catch (err: unknown) {
      setResendError(getErrorMessage(err, 'Unable to send a new link. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-xl p-6 sm:p-8 text-center">
      <div className="flex justify-center mb-6">
        <Logo />
      </div>

      {state.kind === 'checking' && (
        <div className="py-8 flex flex-col items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400" role="status">
          <Spinner />
          Verifying your email address...
        </div>
      )}

      {state.kind === 'done' && (
        <div className="space-y-4" role="status">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-base font-bold text-zinc-950 dark:text-white">Email verified</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{state.message}</p>
          <Link href="/login" className={buttonClass}>
            Sign in <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {state.kind === 'failed' && (
        <div className="space-y-5">
          <div className="space-y-3" role="alert">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <h1 className="text-base font-bold text-zinc-950 dark:text-white">Link not valid</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{state.message}</p>
          </div>

          <form onSubmit={resend} className="space-y-3 text-left" noValidate>
            <label htmlFor="verify-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Send a new verification link to
            </label>
            <input
              id="verify-email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={resending}
              className={fieldClass}
            />
            {resendError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400" role="alert">
                {resendError}
              </p>
            )}
            {resendNotice && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5" role="status">
                <MailCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {resendNotice}
              </p>
            )}
            <button type="submit" disabled={resending} className={buttonClass}>
              {resending && <Spinner />}
              {resending ? 'Sending...' : 'Send new link'}
            </button>
          </form>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Already verified?{' '}
            <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-4">
      <Suspense fallback={<Spinner />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
