"use client";

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Clock,
  Eye,
  FileText,
  Gift,
  Landmark,
  Plus,
  Receipt,
  Smartphone,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react';
import { api, Deposit, DepositStatus, WalletBucket } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import { WithdrawWalletModal } from '@/components/wallet/WithdrawWalletModal';
import { AddMoneyModal, DEPOSIT_METHOD_LABELS } from '@/components/wallet/AddMoneyModal';
import { TransactionsSection } from '@/components/wallet/TransactionsSection';
import { formatDateTime, formatINR, formatINRShort, formatDate } from '@/lib/format';
import {
  accentButtonClass,
  Alert,
  CardHeader,
  cardClass,
  chipClass,
  EmptyState,
  ErrorState,
  FullPageMessage,
  LoadingRows,
  PageHeader,
  PageShell,
  Pagination,
  primaryButtonClass,
  secondaryButtonClass,
  StatusBadge,
} from '@/components/ui/primitives';
import { useFileViewer } from '@/components/ui/FileViewer';

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: DepositStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function WalletPage() {
  const { token, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DepositStatus | ''>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  // Which wallet the withdraw modal is open for; null = closed
  const [withdrawBucket, setWithdrawBucket] = useState<WalletBucket | null>(null);
  // Deep link: /wallet?tab=transactions (the old /transactions page redirects here).
  // Only the loading placeholder is server-rendered, so reading the URL here cannot cause a hydration mismatch.
  const [tab, setTab] = useState<'deposits' | 'transactions'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'transactions'
      ? 'transactions'
      : 'deposits'
  );
  const viewer = useFileViewer();

  const walletFetcher = useCallback(() => api.getWallet(token as string), [token]);
  const kycFetcher = useCallback(() => api.getKycInfo(token as string), [token]);
  const depositsFetcher = useCallback(
    () => api.getDeposits(token as string, { page, limit: PAGE_SIZE, status }),
    [token, page, status]
  );

  const wallet = useAsyncData(token ? walletFetcher : null);
  const kyc = useAsyncData(token ? kycFetcher : null);
  const deposits = useAsyncData(token ? depositsFetcher : null);

  if (authLoading || !token) return <FullPageMessage>Loading wallet...</FullPageMessage>;

  const summary = wallet.data;
  const config = summary?.config;

  const handleDepositCreated = () => {
    wallet.reload();
    if (page === 1 && (status === '' || status === 'PENDING')) deposits.reload();
    else {
      setStatus('');
      setPage(1);
    }
  };

  const changeStatus = (next: DepositStatus | '') => {
    setStatus(next);
    setPage(1);
  };

  const addMoneyButton = (className: string) => (
    <button type="button" onClick={() => setIsAddOpen(true)} disabled={!config} className={className}>
      <Plus className="w-3.5 h-3.5" />
      <span>Add money</span>
    </button>
  );

  const canWithdrawProfit = Boolean(summary && config && summary.profitBalance > 0);
  const canWithdrawCapital = Boolean(summary && config && summary.capitalBalance > 0);
  const feePercent = config?.capitalWithdrawalFeePercent ?? 0;

  const withdrawProfitButton = (className: string) => (
    <button
      type="button"
      onClick={() => setWithdrawBucket('PROFIT')}
      disabled={!canWithdrawProfit}
      title={summary && summary.profitBalance <= 0 ? 'No profit to withdraw yet' : undefined}
      className={className}
    >
      <Banknote className="w-3.5 h-3.5" />
      <span>Withdraw profit</span>
    </button>
  );
  const withdrawCapitalButton = (className: string) => (
    <button
      type="button"
      onClick={() => setWithdrawBucket('CAPITAL')}
      disabled={!canWithdrawCapital}
      title={
        summary && summary.capitalBalance <= 0
          ? 'No uninvested capital in your wallet'
          : 'Withdraws the full capital balance to your bank account, no fee'
      }
      className={className}
    >
      <Landmark className="w-3.5 h-3.5" />
      <span>Withdraw capital</span>
    </button>
  );

  return (
    <PageShell>
      <PageHeader
        title="Wallet"
        subtitle="Your wallet has two parts: the capital wallet holds the money you deposit and invest, and the profit wallet collects your daily profit and referral commission, ready to withdraw any time."
        actions={
          <div className="hidden sm:flex items-center gap-2">
            {withdrawProfitButton(secondaryButtonClass)}
            {addMoneyButton(primaryButtonClass)}
          </div>
        }
      />

      {wallet.error && !summary ? (
        <div className={cardClass}>
          <ErrorState message={wallet.error} onRetry={wallet.reload} />
        </div>
      ) : !summary ? (
        <div className="h-48 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
      ) : (
        <>
          {wallet.error && <Alert>{wallet.error}</Alert>}

          {/* Two wallets: capital and profit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className={`p-6 ${cardClass}`} aria-labelledby="capital-wallet-heading">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400" id="capital-wallet-heading">
                <Landmark className="w-4 h-4 text-blue-600" />
                Capital wallet
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-zinc-950 dark:text-white tabular-nums tracking-tight mt-1 break-words">
                {formatINR(summary.capitalBalance)}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Available to invest or withdraw.
                {summary.investedCapital > 0
                  ? ` ${formatINR(summary.investedCapital)} more is invested and earning daily profit across ${summary.activeInvestments} active plan${
                      summary.activeInvestments === 1 ? '' : 's'
                    }.`
                  : ' Nothing is invested yet; pick a plan to start earning daily profit.'}
              </p>

              <dl className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/[0.06] grid grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Invested &amp; earning
                  </dt>
                  <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                    {formatINR(summary.investedCapital)}
                    <span className="font-normal text-zinc-500">
                      {' '}
                      · {summary.activeInvestments} active plan{summary.activeInvestments === 1 ? '' : 's'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending verification
                  </dt>
                  <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                    {formatINR(summary.pendingDepositAmount)}
                    <span className="font-normal text-zinc-500">
                      {' '}
                      · {summary.pendingDepositCount} payment{summary.pendingDepositCount === 1 ? '' : 's'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Total deposited</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">{formatINR(summary.totalDeposited)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-zinc-400" /> Top-up limits
                  </dt>
                  <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                    {formatINRShort(summary.config.minTopup)} – {formatINRShort(summary.config.maxTopup)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {addMoneyButton(accentButtonClass)}
                <Link href="/plans" className={secondaryButtonClass}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Invest</span>
                </Link>
                {withdrawCapitalButton(secondaryButtonClass)}
              </div>
              <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
                Only capital earns profit. Capital in this wallet can be withdrawn in full at any time with no fee;
                re-investing it costs nothing. Closing a running plan before it ends carries a {feePercent}% early
                withdrawal fee.
                {summary.pendingCapitalWithdrawalAmount > 0 && (
                  <>
                    {' '}
                    {formatINR(summary.pendingCapitalWithdrawalAmount)} is reserved for a{' '}
                    <Link href="/investments?tab=withdrawals" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                      capital withdrawal in progress
                    </Link>
                    .
                  </>
                )}
              </p>
            </section>

            <section className={`p-6 ${cardClass}`} aria-labelledby="profit-wallet-heading">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400" id="profit-wallet-heading">
                <WalletIcon className="w-4 h-4 text-emerald-500" />
                Profit wallet
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight mt-1 break-words">
                {formatINR(summary.profitBalance)}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Withdraw any time, no fee.
                {summary.pendingProfitWithdrawalAmount > 0 && (
                  <>
                    {' '}
                    {formatINR(summary.pendingProfitWithdrawalAmount)} is reserved for{' '}
                    <Link href="/investments?tab=withdrawals" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                      withdrawals in progress
                    </Link>
                    .
                  </>
                )}
              </p>

              <dl className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/[0.06] grid grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Today&apos;s credit
                  </dt>
                  <dd className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                    +{formatINR(summary.profitCreditedToday)}
                    <span className="font-normal text-zinc-500"> · Mon–Fri at 6:00 AM</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">This month</dt>
                  <dd className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                    +{formatINR(summary.profitCreditedThisMonth)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Daily profit credited so far</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                    {formatINR(summary.dailyProfitCredited)}
                    {summary.lastProfitCreditDay && (
                      <span className="font-normal text-zinc-500"> · last on {formatDate(summary.lastProfitCreditDay)}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-violet-500" /> Referral commission
                  </dt>
                  <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                    {formatINR(summary.referralEarnings)}
                    {summary.referralEarningsPending > 0 && (
                      <span className="font-normal text-zinc-500"> · {formatINR(summary.referralEarningsPending)} pending</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {withdrawProfitButton(accentButtonClass)}
                <Link href="/plans" className={secondaryButtonClass}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Re-invest profit</span>
                </Link>
              </div>
              <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
                Profit does not earn profit by itself. Re-invest it in a plan to turn it into capital that earns.
              </p>
            </section>
          </div>

          {summary.pendingDepositCount > 0 ? (
            <Alert tone="warning">
              <strong>{formatINR(summary.pendingDepositAmount)}</strong> across {summary.pendingDepositCount} payment
              {summary.pendingDepositCount === 1 ? '' : 's'} is awaiting admin verification. It is added to your capital
              wallet as soon as the receipt is approved; you will get a notification either way.
            </Alert>
          ) : (
            <Alert tone="info">
              Deposits land in your capital wallet after an admin verifies your payment receipt. Daily profit from your
              plans and referral commission land in your profit wallet every working day at 6:00 AM. Withdrawals are
              paid to your registered bank account after admin verification.
            </Alert>
          )}
        </>
      )}

      {/* History: deposits + full wallet ledger */}
      <div className={`${cardClass} overflow-hidden`}>
        <CardHeader
          icon={tab === 'deposits' ? <FileText /> : <Receipt />}
          title={tab === 'deposits' ? 'Deposits' : 'Transactions'}
          action={
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-white/10 p-0.5 text-[11px] font-semibold" role="tablist" aria-label="History view">
              {(
                [
                  { id: 'deposits', label: 'Deposits' },
                  { id: 'transactions', label: 'Transactions' },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === option.id}
                  onClick={() => setTab(option.id)}
                  className={`px-3 py-1 rounded-md transition ${
                    tab === option.id
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                      : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />

        {tab === 'transactions' && <TransactionsSection token={token} />}

        {tab === 'deposits' && (
        <>
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06] flex items-center gap-2 flex-wrap" role="tablist" aria-label="Filter deposits by status">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              role="tab"
              aria-selected={status === option.value}
              onClick={() => changeStatus(option.value)}
              className={chipClass(status === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {deposits.error && !deposits.data ? (
          <ErrorState message={deposits.error} onRetry={deposits.reload} />
        ) : !deposits.data ? (
          <LoadingRows />
        ) : deposits.data.items.length === 0 ? (
          <EmptyState
            icon={<WalletIcon className="w-4 h-4" />}
            title={status ? `No ${status.toLowerCase()} deposits` : 'No deposits yet'}
            description={
              status
                ? 'Deposits with this status will appear here.'
                : 'Add money to your wallet by bank transfer (NEFT, IMPS or RTGS). Your deposit requests and their verification status will appear here.'
            }
            action={status ? undefined : addMoneyButton(accentButtonClass)}
          />
        ) : (
          <>
            {deposits.error && <Alert className="m-4">{deposits.error}</Alert>}
            <ul
              className={`md:hidden divide-y divide-zinc-100 dark:divide-white/[0.04] transition-opacity ${deposits.loading ? 'opacity-60' : ''}`}
              aria-busy={deposits.loading}
            >
              {deposits.data.items.map((deposit: Deposit) => (
                <li key={deposit.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">{formatINR(deposit.amount)}</div>
                      <div className="text-[10px] text-zinc-500">
                        {DEPOSIT_METHOD_LABELS[deposit.paymentMethod] || 'UPI'} · {formatDateTime(deposit.createdAt)}
                      </div>
                    </div>
                    <StatusBadge status={deposit.status} kind="deposit" />
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-zinc-500">Reference</dt>
                    <dd className="text-right font-mono text-zinc-600 dark:text-zinc-300 truncate">{deposit.reference}</dd>
                    <dt className="text-zinc-500">Txn ref</dt>
                    <dd className="text-right font-mono text-zinc-700 dark:text-zinc-200 break-all">{deposit.upiTransactionId}</dd>
                  </dl>
                  {deposit.status === 'REJECTED' && deposit.rejectionReason ? (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{deposit.rejectionReason}</p>
                  ) : deposit.adminRemarks ? (
                    <p className="text-[11px] text-zinc-500">{deposit.adminRemarks}</p>
                  ) : null}
                  {deposit.hasReceipt && (
                    <button
                      type="button"
                      disabled={viewer.busy}
                      onClick={() => viewer.open(`Receipt ${deposit.reference}`, () => api.getDepositReceipt(token, deposit.id))}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium disabled:opacity-50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View receipt</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className={`hidden md:block overflow-x-auto transition-opacity ${deposits.loading ? 'opacity-60' : ''}`} aria-busy={deposits.loading}>
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-100 dark:border-white/[0.04]">
                  <tr>
                    <th scope="col" className="py-3 px-5">Reference</th>
                    <th scope="col" className="py-3 px-5">Amount</th>
                    <th scope="col" className="py-3 px-5">Paid via</th>
                    <th scope="col" className="py-3 px-5">Transaction reference</th>
                    <th scope="col" className="py-3 px-5">Status</th>
                    <th scope="col" className="py-3 px-5">Remarks</th>
                    <th scope="col" className="py-3 px-5">Submitted</th>
                    <th scope="col" className="py-3 px-5">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                  {deposits.data.items.map((deposit: Deposit) => (
                    <tr key={deposit.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition align-top">
                      <td className="py-3.5 px-5 font-mono text-zinc-500 whitespace-nowrap">{deposit.reference}</td>
                      <td className="py-3.5 px-5 tabular-nums font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                        {formatINR(deposit.amount)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                        {DEPOSIT_METHOD_LABELS[deposit.paymentMethod] || deposit.paymentMethod || 'UPI'}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-zinc-700 dark:text-zinc-300 break-all">{deposit.upiTransactionId}</td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={deposit.status} kind="deposit" />
                        {deposit.reviewedAt && (
                          <div className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">Reviewed {formatDateTime(deposit.reviewedAt)}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-400 max-w-56">
                        {deposit.status === 'REJECTED' && deposit.rejectionReason ? (
                          <span className="text-rose-600 dark:text-rose-400">{deposit.rejectionReason}</span>
                        ) : (
                          deposit.adminRemarks || '—'
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatDateTime(deposit.createdAt)}
                      </td>
                      <td className="py-3.5 px-5">
                        {deposit.hasReceipt ? (
                          <button
                            type="button"
                            disabled={viewer.busy}
                            onClick={() =>
                              viewer.open(`Receipt ${deposit.reference}`, () => api.getDepositReceipt(token, deposit.id))
                            }
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50 whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View receipt</span>
                          </button>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={deposits.data.meta} onPageChange={setPage} disabled={deposits.loading} />
          </>
        )}
        </>
        )}
      </div>

      {isAddOpen && config && (
        <AddMoneyModal
          token={token}
          config={config}
          onClose={() => setIsAddOpen(false)}
          onCreated={handleDepositCreated}
        />
      )}

      {withdrawBucket && summary && config && (
        <WithdrawWalletModal
          key={withdrawBucket}
          token={token}
          summary={summary}
          config={config}
          bucket={withdrawBucket}
          kycVerified={kyc.data?.status === 'VERIFIED'}
          onClose={() => setWithdrawBucket(null)}
          onRequested={() => wallet.reload()}
        />
      )}

      {viewer.modal}
    </PageShell>
  );
}
