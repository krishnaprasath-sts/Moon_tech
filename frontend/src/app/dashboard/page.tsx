"use client";

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Clock,
  PiggyBank,
  Plus,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useStoredItem, writeStoredItem } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import { formatDate, formatDateTime, formatINR, TRANSACTION_TYPE_LABELS } from '@/lib/format';
import { KycModal } from '@/components/kyc/KycModal';
import {
  Alert,
  CardHeader,
  cardClass,
  EmptyState,
  ErrorState,
  FullPageMessage,
  LoadingRows,
  PageShell,
  StatusBadge,
} from '@/components/ui/primitives';

const KYC_BANNER_DISMISSED_KEY = 'moontech-kyc-banner-dismissed';

export default function DashboardPage() {
  return (
    <Suspense fallback={<FullPageMessage>Loading dashboard...</FullPageMessage>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user, loading: authLoading } = useAuth();

  // null = follow the ?kyc=true query parameter
  const [kycModalOpen, setKycModalOpen] = useState<boolean | null>(null);
  // Hydration-safe read of the dismissal flag, with an in-memory fallback when storage is blocked
  const storedDismissed = useStoredItem(KYC_BANNER_DISMISSED_KEY) === 'true';
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
  const bannerDismissed = storedDismissed || dismissedThisVisit;

  const walletFetcher = useCallback(() => api.getWallet(token as string), [token]);
  const profileFetcher = useCallback(() => api.getProfile(token as string), [token]);
  const kycFetcher = useCallback(() => api.getKycInfo(token as string), [token]);
  const investmentsFetcher = useCallback(() => api.getInvestments(token as string, { page: 1, limit: 5 }), [token]);
  const transactionsFetcher = useCallback(() => api.getTransactions(token as string, { page: 1, limit: 5 }), [token]);
  const unreadFetcher = useCallback(() => api.getUnreadCount(token as string), [token]);

  const wallet = useAsyncData(token ? walletFetcher : null);
  const profile = useAsyncData(token ? profileFetcher : null);
  const kyc = useAsyncData(token ? kycFetcher : null);
  const investments = useAsyncData(token ? investmentsFetcher : null);
  const transactions = useAsyncData(token ? transactionsFetcher : null);
  const unread = useAsyncData(token ? unreadFetcher : null);

  if (authLoading || !token) return <FullPageMessage>Loading dashboard...</FullPageMessage>;

  const kycParam = searchParams.get('kyc') === 'true';
  const isKycModalOpen = kycModalOpen ?? kycParam;

  const closeKycModal = () => {
    setKycModalOpen(false);
    if (kycParam) router.replace('/dashboard', { scroll: false });
  };

  const summary = wallet.data;
  const kycStatus = kyc.data?.status || 'DRAFT';
  const kycKnown = Boolean(kyc.data);
  const kycRequired = Boolean(summary?.config.requireKycForInvestment);
  const isKycVerified = kycStatus === 'VERIFIED';
  const isKycUnderReview = kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW';
  const isKycRejected = kycStatus === 'REJECTED' || kycStatus === 'RESUBMISSION_REQUIRED';

  const displayName = profile.data?.fullName || user?.fullName || user?.name || '';
  const email = profile.data?.email || user?.email || '';
  const unreadCount = unread.data || 0;

  // Required KYC cannot be dismissed; the optional recommendation can.
  const showKycBanner = kycKnown && !isKycVerified && (kycRequired || !bannerDismissed);

  const dismissBanner = () => {
    setDismissedThisVisit(true);
    writeStoredItem(KYC_BANNER_DISMISSED_KEY, 'true');
  };

  const bannerTone = isKycRejected
    ? 'border-rose-500/30 dark:border-rose-500/20 bg-rose-500/[0.02]'
    : isKycUnderReview || kycRequired
    ? 'border-amber-500/30 dark:border-amber-500/20 bg-amber-500/[0.02]'
    : 'border-blue-500/30 dark:border-blue-500/20 bg-blue-500/[0.02]';
  const bannerIconTone = isKycRejected
    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
    : isKycUnderReview || kycRequired
    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
    : 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400';

  const bannerTitle = isKycUnderReview
    ? 'KYC verification pending review'
    : isKycRejected
    ? 'KYC verification needs your attention'
    : kycRequired
    ? 'KYC verification is required to invest'
    : 'Recommended: verify your identity (optional)';

  const bannerText = isKycUnderReview
    ? 'Your identity and bank details are with the compliance team. You will be notified once the review is complete.'
    : isKycRejected
    ? kyc.data?.rejectionReason
      ? `Compliance update: ${kyc.data.rejectionReason}. Please resubmit with updated documents.`
      : 'Your submitted documents need clarification. Please update your details and resubmit.'
    : kycRequired
    ? 'You need to complete identity verification before you can invest in a plan. You can still add money to your wallet.'
    : 'KYC is optional. You can add money and invest without it. Verifying your identity helps us process your payouts faster.';

  const stats = summary
    ? [
        {
          label: 'Wallet balance',
          value: formatINR(summary.balance),
          icon: <Wallet className="w-4 h-4 text-blue-600" />,
          footer: 'Available to invest',
          href: '/wallet',
          linkLabel: 'Add money',
          profit: false,
        },
        {
          label: 'Invested amount',
          value: formatINR(summary.investedAmount),
          icon: <PiggyBank className="w-4 h-4 text-blue-600" />,
          footer: `${summary.activeInvestments} active investment${summary.activeInvestments === 1 ? '' : 's'}`,
          href: '/investments?status=ACTIVE',
          linkLabel: 'View',
          profit: false,
        },
        {
          label: 'Expected profit',
          value: `+${formatINR(summary.expectedProfit)}`,
          icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
          footer: 'On active investments, at maturity',
          href: undefined,
          linkLabel: '',
          profit: true,
        },
        {
          label: 'Profit earned',
          value: `+${formatINR(summary.totalProfitEarned)}`,
          icon: <Banknote className="w-4 h-4 text-emerald-500" />,
          footer: `Total withdrawn ${formatINR(summary.totalWithdrawn)}`,
          href: '/investments?tab=withdrawals',
          linkLabel: 'Withdrawals',
          profit: true,
        },
      ]
    : [];

  const quickActions = [
    { label: 'Add money', description: 'Top up by UPI', href: '/wallet', icon: <Plus className="w-4 h-4" /> },
    { label: 'Invest', description: 'Browse plans', href: '/plans', icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'My investments', description: 'Track maturity', href: '/investments', icon: <PiggyBank className="w-4 h-4" /> },
    { label: 'Transactions', description: 'Full history', href: '/transactions', icon: <Receipt className="w-4 h-4" /> },
  ];

  return (
    <PageShell>
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/[0.06]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
              {displayName ? `Welcome back, ${displayName}` : 'Investment overview'}
            </h1>

            {kycKnown && (
              <button
                type="button"
                onClick={() => setKycModalOpen(true)}
                title="View KYC details"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isKycVerified
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : isKycUnderReview
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    : isKycRejected || kycRequired
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                    : 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20'
                }`}
              >
                {isKycVerified ? <ShieldCheck className="w-3 h-3" /> : isKycUnderReview ? <Clock className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                <span>
                  {isKycVerified
                    ? 'KYC VERIFIED'
                    : isKycUnderReview
                    ? 'KYC UNDER REVIEW'
                    : isKycRejected
                    ? 'KYC ACTION NEEDED'
                    : kycRequired
                    ? 'KYC REQUIRED'
                    : 'KYC OPTIONAL'}
                </span>
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono truncate">{email}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/wallet"
            className="px-4 py-2 rounded-full text-xs font-semibold transition active:scale-95 shadow-xs flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add money</span>
          </Link>
          <Link
            href="/plans"
            className="px-4 py-2 rounded-full text-xs font-semibold transition active:scale-95 shadow-xs flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Invest</span>
          </Link>
        </div>
      </div>

      {/* Unread notifications hint */}
      {unreadCount > 0 && (
        <Link
          href="/notifications"
          className="flex items-center justify-between gap-3 p-3 px-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 transition"
        >
          <span className="flex items-center gap-2 font-medium">
            <Bell className="w-4 h-4" />
            You have {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1 font-semibold">
            View <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      )}

      {/* KYC banner: soft recommendation unless the admin requires KYC */}
      {showKycBanner && (
        <div className={`rounded-2xl p-5 border transition-all duration-200 shadow-xs bg-white dark:bg-zinc-900/40 relative ${bannerTone}`}>
          {!kycRequired && (
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss KYC recommendation"
              className="absolute right-3 top-3 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-6">
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0 ${bannerIconTone}`}>
                {isKycUnderReview ? <Clock className="w-5 h-5" /> : kycRequired || isKycRejected ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{bannerTitle}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed max-w-2xl">{bannerText}</p>
              </div>
            </div>

            <div className="flex-shrink-0 w-full sm:w-auto">
              {isKycUnderReview ? (
                <button
                  type="button"
                  onClick={() => setKycModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.05] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/10 transition"
                >
                  View submitted KYC
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setKycModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition active:scale-95 shadow-xs flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isKycRejected ? 'Resubmit KYC documents' : 'Complete KYC verification'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overview stats */}
      {wallet.error && !summary ? (
        <div className={cardClass}>
          <ErrorState message={wallet.error} onRetry={wallet.reload} />
        </div>
      ) : !summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-32 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {wallet.error && <Alert>{wallet.error}</Alert>}

          {/* Things that need attention */}
          {summary.maturedInvestments > 0 && (
            <Alert
              tone="success"
              action={
                <Link href="/investments?status=MATURED" className="inline-flex items-center gap-1 font-semibold underline">
                  Request withdrawal <ArrowRight className="w-3 h-3" />
                </Link>
              }
            >
              <strong>
                {summary.maturedInvestments} investment{summary.maturedInvestments === 1 ? ' has' : 's have'} matured.
              </strong>{' '}
              You can request the payout of your principal and profit now.
            </Alert>
          )}
          {summary.pendingDepositCount > 0 && (
            <Alert
              tone="warning"
              action={
                <Link href="/wallet" className="inline-flex items-center gap-1 font-semibold underline">
                  Track <ArrowRight className="w-3 h-3" />
                </Link>
              }
            >
              <strong>{formatINR(summary.pendingDepositAmount)}</strong> across {summary.pendingDepositCount} deposit
              {summary.pendingDepositCount === 1 ? '' : 's'} is awaiting admin verification. It is added to your balance once
              the receipt is approved.
            </Alert>
          )}
          {summary.pendingWithdrawals > 0 && (
            <Alert
              tone="info"
              action={
                <Link href="/investments?tab=withdrawals" className="inline-flex items-center gap-1 font-semibold underline">
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              }
            >
              {summary.pendingWithdrawals} withdrawal request{summary.pendingWithdrawals === 1 ? ' is' : 's are'} being
              processed.
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((stat) => (
              <div key={stat.label} className={`p-5 ${cardClass}`}>
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  <span className="font-medium">{stat.label}</span>
                  {stat.icon}
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums tracking-tight break-words ${
                    stat.profit ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'
                  }`}
                >
                  {stat.value}
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-500">{stat.footer}</span>
                  {stat.href && (
                    <Link href={stat.href} className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-0.5 shrink-0">
                      {stat.linkLabel} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick actions */}
      <nav aria-label="Quick actions" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="p-4 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200/90 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.16] shadow-xs transition flex items-center gap-3"
          >
            <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              {action.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-zinc-950 dark:text-white">{action.label}</span>
              <span className="block text-[11px] text-zinc-500 truncate">{action.description}</span>
            </span>
          </Link>
        ))}
      </nav>

      {/* Recent investments */}
      <div className={`${cardClass} overflow-hidden`}>
        <CardHeader
          icon={<PiggyBank />}
          title="Recent investments"
          action={
            <Link href="/investments" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium">
              View all
            </Link>
          }
        />

        {investments.error && !investments.data ? (
          <ErrorState message={investments.error} onRetry={investments.reload} />
        ) : !investments.data ? (
          <LoadingRows rows={3} />
        ) : investments.data.items.length === 0 ? (
          <EmptyState
            icon={<Plus className="w-4 h-4" />}
            title="No investments yet"
            description="Add money to your wallet, then choose a plan to start earning."
            action={
              <Link href="/plans" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition shadow-xs">
                View investment plans
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-100 dark:border-white/[0.04]">
                <tr>
                  <th scope="col" className="py-3 px-5">Investment ID</th>
                  <th scope="col" className="py-3 px-5">Plan</th>
                  <th scope="col" className="py-3 px-5">Amount</th>
                  <th scope="col" className="py-3 px-5">Maturity amount</th>
                  <th scope="col" className="py-3 px-5">Maturity date</th>
                  <th scope="col" className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {investments.data.items.map((investment) => (
                  <tr key={investment.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-5 font-mono text-zinc-500 whitespace-nowrap">{investment.reference}</td>
                    <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-white">{investment.planName}</td>
                    <td className="py-3.5 px-5 tabular-nums text-zinc-900 dark:text-zinc-200 whitespace-nowrap">{formatINR(investment.amount)}</td>
                    <td className="py-3.5 px-5 tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatINR(investment.maturityAmount)}
                    </td>
                    <td className="py-3.5 px-5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(investment.maturityDate)}
                      {investment.status === 'ACTIVE' && (
                        <span className="text-zinc-400"> · {Math.max(0, Number(investment.daysRemaining) || 0)}d left</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <StatusBadge status={investment.status} kind="investment" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className={`${cardClass} overflow-hidden`}>
        <CardHeader
          icon={<Receipt />}
          title="Recent transactions"
          action={
            <Link href="/transactions" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium">
              View all
            </Link>
          }
        />

        {transactions.error && !transactions.data ? (
          <ErrorState message={transactions.error} onRetry={transactions.reload} />
        ) : !transactions.data ? (
          <LoadingRows rows={3} />
        ) : transactions.data.items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-4 h-4" />}
            title="No transactions yet"
            description="Your wallet activity will appear here once your first deposit is verified."
          />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {transactions.data.items.map((txn) => {
              const isCredit = txn.direction === 'CREDIT';
              return (
                <li key={txn.id} className="p-4 px-5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isCredit
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                      aria-hidden="true"
                    >
                      {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-white">
                        {TRANSACTION_TYPE_LABELS[txn.type] || txn.type}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {txn.description || txn.reference} · {formatDateTime(txn.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`tabular-nums font-semibold ${
                        isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatINR(txn.amount)}
                      <span className="sr-only">{isCredit ? ' credit' : ' debit'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 tabular-nums">Balance {formatINR(txn.balanceAfter)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <KycModal
        isOpen={isKycModalOpen && kycKnown}
        onClose={closeKycModal}
        token={token}
        kycStatus={kycStatus}
        rejectionReason={kyc.data?.rejectionReason || ''}
        defaultHolderName={displayName}
        onSubmitted={kyc.reload}
      />
    </PageShell>
  );
}
