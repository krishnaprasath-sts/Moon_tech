'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Gift,
  Link2,
  MessageCircle,
  Share2,
  Users,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { api, ReferralCommission, ReferralCommissionStatus, ReferredCustomer } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import { formatDate, formatDateTime, formatINR, humanize, PAYOUT_TIME_LABEL } from '@/lib/format';
import {
  accentButtonClass,
  CardHeader,
  cardClass,
  EmptyState,
  ErrorState,
  FullPageMessage,
  LoadingRows,
  PageHeader,
  PageShell,
  secondaryButtonClass,
  StatusBadge,
} from '@/components/ui/primitives';

type Tab = 'referrals' | 'commissions';

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = useCallback((text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => undefined);
  }, []);
  return [copied, copy];
}

function shareUrl(code: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
}

export default function ReferralsPage() {
  const { token, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('referrals');
  const fetcher = useCallback(() => api.getMyReferrals(token as string), [token]);
  const referrals = useAsyncData(token ? fetcher : null);
  const [codeCopied, copyCode] = useCopy();
  const [linkCopied, copyLink] = useCopy();

  if (authLoading || !token) return <FullPageMessage>Loading referrals...</FullPageMessage>;

  const data = referrals.data;
  const link = data ? shareUrl(data.referralCode) : '';
  // Recurring commission: per working day, and per month (20 paying days a month, like daily profit)
  const dailyPct = data?.dailyCommissionPercent ?? 0;
  const monthlyPct = Math.round(dailyPct * 20 * 10000) / 10000;
  const hasDaily = dailyPct > 0;
  const shareText = data
    ? `Join me on Clyvus Ventures and start earning daily profit on your investments. Use my referral code ${data.referralCode} when you sign up: ${link}`
    : '';

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const nativeShare = () => {
    if (!canNativeShare || !data) return;
    navigator.share({ title: 'Clyvus Ventures', text: shareText, url: link }).catch(() => undefined);
  };

  return (
    <PageShell>
      <PageHeader
        title="Referrals"
        subtitle={
          data
            ? hasDaily
              ? `Earn ${data.commissionPercent}% instantly on every amount people you refer invest, plus ${dailyPct}% of it every working day (${monthlyPct}% a month) while their investment runs, all credited to your profit wallet.`
              : `Earn ${data.commissionPercent}% of every amount invested by people you refer, credited to your profit wallet instantly when they invest.`
            : 'Invite friends and earn a commission on every investment they make.'
        }
        actions={
          <Link href="/wallet" className={secondaryButtonClass}>
            <Wallet className="w-3.5 h-3.5" />
            <span>Go to wallet</span>
          </Link>
        }
      />

      {referrals.error && !data ? (
        <div className="mt-6">
          <ErrorState message={referrals.error} onRetry={referrals.reload} />
        </div>
      ) : !data ? (
        <div className={`${cardClass} mt-6 p-5`}>
          <LoadingRows rows={4} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Share card */}
          <section className={`${cardClass} p-5 sm:p-6`} aria-label="Share your referral code">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <Gift className="w-3.5 h-3.5" /> Your referral code
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.2em] text-zinc-950 dark:text-white select-all">
                    {data.referralCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyCode(data.referralCode)}
                    className={secondaryButtonClass}
                    aria-label="Copy referral code"
                  >
                    {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{codeCopied ? 'Copied' : 'Copy code'}</span>
                  </button>
                </div>
                <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Friends enter this code while registering, or simply open your link below and it is filled in for them.
                  You earn an instant <strong className="text-zinc-900 dark:text-white">{data.commissionPercent}%</strong> commission on each investment they make
                  {hasDaily ? (
                    <>
                      , plus <strong className="text-zinc-900 dark:text-white">{dailyPct}% every working day ({monthlyPct}% a month)</strong> while their
                      investment is active, paid into your profit wallet at {PAYOUT_TIME_LABEL}.
                    </>
                  ) : (
                    ', paid into your profit wallet.'
                  )}
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 px-3 py-2">
                    <Link2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate select-all">{link}</span>
                  </div>
                  <button type="button" onClick={() => copyLink(link)} className={accentButtonClass}>
                    {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{linkCopied ? 'Link copied' : 'Copy link'}</span>
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={secondaryButtonClass}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Share on WhatsApp</span>
                  </a>
                  {canNativeShare && (
                    <button type="button" onClick={nativeShare} className={secondaryButtonClass}>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>More ways to share</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 lg:w-[360px] shrink-0">
                <Stat label="People referred" value={String(data.totalReferrals)} hint={`${data.verifiedReferrals} KYC verified`} />
                <Stat
                  label="Commission earned"
                  value={formatINR(data.totalCommissionEarned)}
                  hint="Credited to your wallet"
                  accent
                />
                <Stat
                  label="Pending commission"
                  value={formatINR(data.pendingCommission)}
                  hint={
                    data.pendingCommissionCount > 0
                      ? `${data.pendingCommissionCount} credit${data.pendingCommissionCount === 1 ? '' : 's'} due at ${PAYOUT_TIME_LABEL}`
                      : 'Nothing waiting'
                  }
                />
                <Stat
                  label="Your rate"
                  value={hasDaily ? `${data.commissionPercent}% + ${monthlyPct}%/mo` : `${data.commissionPercent}%`}
                  hint={hasDaily ? `Instant ${data.commissionPercent}% + ${dailyPct}% every working day` : 'Of each referred investment'}
                />
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="How referrals work">
            <Step n={1} title="Share your code or link" text="Send it on WhatsApp or anywhere else. The link pre-fills your code." />
            <Step n={2} title="Your friend invests" text="They register, complete KYC, add money and invest in any plan." />
            <Step
              n={3}
              title="You get paid"
              text={
                hasDaily
                  ? `${data.commissionPercent}% of their investment lands in your profit wallet the moment they invest, then ${dailyPct}% of it every working day (${monthlyPct}% a month) while it runs.`
                  : `${data.commissionPercent}% of their investment lands in your profit wallet the moment they invest.`
              }
            />
          </section>

          {/* Lists */}
          <section className={cardClass} aria-label="Referral activity">
            <CardHeader
              icon={<Users />}
              title={tab === 'referrals' ? 'People you referred' : 'Commission history'}
              action={
                <div className="inline-flex rounded-lg border border-zinc-200 dark:border-white/10 p-0.5 text-[11px] font-semibold">
                  <TabButton active={tab === 'referrals'} onClick={() => setTab('referrals')}>
                    Referred ({data.referrals.length})
                  </TabButton>
                  <TabButton active={tab === 'commissions'} onClick={() => setTab('commissions')}>
                    Commissions ({data.commissions.length})
                  </TabButton>
                </div>
              }
            />
            {tab === 'referrals' ? (
              data.referrals.length === 0 ? (
                <EmptyState
                  title="No referrals yet"
                  description="Share your code with friends. Everyone who signs up with it appears here."
                />
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                  {data.referrals.map((r) => (
                    <ReferredRow key={r.id} referred={r} />
                  ))}
                </ul>
              )
            ) : data.commissions.length === 0 ? (
              <EmptyState
                title="No commission yet"
                description="You earn a commission every time someone you referred makes an investment."
              />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                {data.commissions.map((c) => (
                  <CommissionRow key={c.id} commission={c} />
                ))}
              </ul>
            )}
          </section>

          {data.referredBy && (
            <p className="text-[11px] text-zinc-500">
              You joined with referral code <span className="font-mono font-semibold">{data.referredBy}</span>.
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-black/20 p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-zinc-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className={`${cardClass} p-4 flex gap-3`}>
      <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div>
        <div className="text-xs font-semibold text-zinc-900 dark:text-white">{title}</div>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-md transition ${
        active
          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
          : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function ReferredRow({ referred }: { referred: ReferredCustomer }) {
  const verified = referred.kycStatus === 'VERIFIED';
  return (
    <li className="p-4 px-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-200 shrink-0">
        {(referred.fullName || '?').slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-zinc-950 dark:text-white truncate">{referred.fullName}</span>
          <StatusBadge status={referred.kycStatus} kind="kyc" label={verified ? 'KYC verified' : `KYC ${humanize(referred.kycStatus).toLowerCase()}`} />
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5">Joined {formatDate(referred.joinedAt)}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Earned from them</div>
        <div className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(referred.commissionEarned)}</div>
      </div>
    </li>
  );
}

function commissionIcon(status: ReferralCommissionStatus) {
  if (status === 'CREDITED') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  if (status === 'CANCELLED') return <XCircle className="w-4 h-4 text-zinc-400" />;
  return <Clock className="w-4 h-4 text-amber-500" />;
}

function CommissionRow({ commission }: { commission: ReferralCommission }) {
  const pending = commission.status === 'PENDING';
  return (
    <li className="p-4 px-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="shrink-0">{commissionIcon(commission.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-zinc-950 dark:text-white">
          {commission.referredName} invested {formatINR(commission.investmentAmount)}
          {commission.planName ? <span className="text-zinc-500 font-normal"> in {commission.planName}</span> : null}
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5">
          {commission.status === 'CREDITED' && commission.creditedAt
            ? `Credited ${formatDateTime(commission.creditedAt)}`
            : commission.status === 'CANCELLED'
            ? `Cancelled${commission.cancelledAt ? ` ${formatDateTime(commission.cancelledAt)}` : ''} (investment was cancelled)`
            : 'Being credited'}
          {commission.investmentReference ? ` · ${commission.investmentReference}` : ''}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold tabular-nums ${pending ? 'text-amber-600 dark:text-amber-400' : commission.status === 'CREDITED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 line-through'}`}>
          +{formatINR(commission.amount)}
        </div>
        <div className="text-[10px] text-zinc-500">{commission.commissionPercent}% · {humanize(commission.status)}</div>
      </div>
      {pending && (
        <Link href="/wallet" className="hidden sm:inline-flex text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white items-center gap-1">
          Wallet <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </li>
  );
}
