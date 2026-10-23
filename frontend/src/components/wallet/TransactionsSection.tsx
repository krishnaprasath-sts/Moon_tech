'use client';

import React, { useCallback, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Filter, Receipt } from 'lucide-react';
import { api, TransactionType, WalletBucket } from '@/lib/api';
import { useAsyncData } from '@/lib/useAsyncData';
import { BUCKET_LABELS, formatDateTime, formatINR, TRANSACTION_TYPE_LABELS } from '@/lib/format';
import {
  Alert,
  chipClass,
  EmptyState,
  ErrorState,
  inputClass,
  LoadingRows,
  Pagination,
  primaryButtonClass,
  secondaryButtonClass,
  StatusBadge,
} from '@/components/ui/primitives';

const PAGE_SIZE = 15;

interface DateRange {
  startDate: string;
  endDate: string;
}

const EMPTY_RANGE: DateRange = { startDate: '', endDate: '' };

const TYPE_CHIPS: { value: TransactionType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  ...(Object.entries(TRANSACTION_TYPE_LABELS) as [TransactionType, string][]).map(([value, label]) => ({ value, label })),
];

const BUCKET_CHIPS: { value: WalletBucket | ''; label: string }[] = [
  { value: '', label: 'Both wallets' },
  { value: 'CAPITAL', label: 'Capital wallet' },
  { value: 'PROFIT', label: 'Profit wallet' },
];

/**
 * Wallet ledger (every credit and debit with the balance after each entry),
 * rendered as a tab inside the wallet page.
 */
export function TransactionsSection({ token }: { token: string }) {
  const [type, setType] = useState<TransactionType | ''>('');
  const [bucket, setBucket] = useState<WalletBucket | ''>('');
  const [draftRange, setDraftRange] = useState<DateRange>(EMPTY_RANGE);
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [rangeError, setRangeError] = useState('');
  const [page, setPage] = useState(1);
  const [showDates, setShowDates] = useState(false);

  const fetcher = useCallback(
    () => api.getTransactions(token, { page, limit: PAGE_SIZE, type, bucket, ...range }),
    [token, page, type, bucket, range]
  );
  const transactions = useAsyncData(fetcher);

  const hasFilters = Boolean(type || bucket || range.startDate || range.endDate);
  const rangeDirty = draftRange.startDate !== range.startDate || draftRange.endDate !== range.endDate;

  const changeType = (next: TransactionType | '') => {
    setType(next);
    setPage(1);
  };

  const changeBucket = (next: WalletBucket | '') => {
    setBucket(next);
    setPage(1);
  };

  const applyRange = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (draftRange.startDate && draftRange.endDate && draftRange.startDate > draftRange.endDate) {
      setRangeError('The start date must be on or before the end date.');
      return;
    }
    setRangeError('');
    setRange(draftRange);
    setPage(1);
  };

  const clearFilters = () => {
    setRangeError('');
    setDraftRange(EMPTY_RANGE);
    setRange(EMPTY_RANGE);
    setType('');
    setBucket('');
    setPage(1);
  };

  return (
    <>
      <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06] space-y-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap max-w-full" role="tablist" aria-label="Filter by wallet">
          {BUCKET_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              role="tab"
              aria-selected={bucket === chip.value}
              onClick={() => changeBucket(chip.value)}
              className={`${chipClass(bucket === chip.value)} whitespace-nowrap`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap max-w-full" role="tablist" aria-label="Filter by transaction type">
          {TYPE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              role="tab"
              aria-selected={type === chip.value}
              onClick={() => changeType(chip.value)}
              className={`${chipClass(type === chip.value)} whitespace-nowrap`}
            >
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowDates((v) => !v)}
            aria-expanded={showDates}
            className={`${chipClass(showDates || Boolean(range.startDate || range.endDate))} whitespace-nowrap ml-auto inline-flex items-center gap-1`}
          >
            <Filter className="w-3 h-3" /> Dates
          </button>
        </div>

        {showDates && (
          <form onSubmit={applyRange} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end" noValidate>
            <div>
              <label htmlFor="filter-start" className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                From date
              </label>
              <input
                id="filter-start"
                type="date"
                value={draftRange.startDate}
                max={draftRange.endDate || undefined}
                onChange={(e) => setDraftRange({ ...draftRange, startDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="filter-end" className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                To date
              </label>
              <input
                id="filter-end"
                type="date"
                value={draftRange.endDate}
                min={draftRange.startDate || undefined}
                onChange={(e) => setDraftRange({ ...draftRange, endDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={!rangeDirty} className={primaryButtonClass}>
                Apply
              </button>
              <button type="button" onClick={clearFilters} disabled={!hasFilters && !rangeDirty} className={secondaryButtonClass}>
                Clear
              </button>
            </div>
          </form>
        )}
        {rangeError && <Alert>{rangeError}</Alert>}
      </div>

      {transactions.error && !transactions.data ? (
        <ErrorState message={transactions.error} onRetry={transactions.reload} />
      ) : !transactions.data ? (
        <LoadingRows rows={6} />
      ) : transactions.data.items.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-4 h-4" />}
          title={hasFilters ? 'No transactions match these filters' : 'No transactions yet'}
          description={
            hasFilters ? 'Try a different type or date range.' : 'Your wallet activity will appear here once your first deposit is verified.'
          }
          action={
            hasFilters ? (
              <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {transactions.error && <Alert className="m-4">{transactions.error}</Alert>}
          <ul
            className={`md:hidden divide-y divide-zinc-100 dark:divide-white/[0.04] transition-opacity ${transactions.loading ? 'opacity-60' : ''}`}
            aria-busy={transactions.loading}
          >
            {transactions.data.items.map((txn) => {
              const isCredit = txn.direction === 'CREDIT';
              return (
                <li key={txn.id} className="p-4 flex gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isCredit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                    aria-hidden="true"
                  >
                    {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {TRANSACTION_TYPE_LABELS[txn.type] || txn.type}
                        <span className="block text-[10px] font-medium text-zinc-500">{BUCKET_LABELS[txn.bucket] || txn.bucket}</span>
                      </div>
                      <div className={`text-sm font-bold tabular-nums whitespace-nowrap ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isCredit ? '+' : '-'}
                        {formatINR(txn.amount)}
                      </div>
                    </div>
                    {txn.description && <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed break-words">{txn.description}</p>}
                    <div className="flex items-center justify-between gap-3 mt-1.5 text-[10px] text-zinc-500">
                      <span className="truncate">{formatDateTime(txn.createdAt)} · <span className="font-mono">{txn.reference}</span></span>
                      <span className="whitespace-nowrap tabular-nums">Bal {formatINR(txn.balanceAfter)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className={`hidden md:block overflow-x-auto transition-opacity ${transactions.loading ? 'opacity-60' : ''}`} aria-busy={transactions.loading}>
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-100 dark:border-white/[0.04]">
                <tr>
                  <th scope="col" className="py-3 px-5">Date</th>
                  <th scope="col" className="py-3 px-5">Type</th>
                  <th scope="col" className="py-3 px-5">Wallet</th>
                  <th scope="col" className="py-3 px-5">Description</th>
                  <th scope="col" className="py-3 px-5">Reference</th>
                  <th scope="col" className="py-3 px-5 text-right">Amount</th>
                  <th scope="col" className="py-3 px-5 text-right">Wallet balance after</th>
                  <th scope="col" className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {transactions.data.items.map((txn) => {
                  const isCredit = txn.direction === 'CREDIT';
                  return (
                    <tr key={txn.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
                      <td className="py-3.5 px-5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{formatDateTime(txn.createdAt)}</td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              isCredit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                            aria-hidden="true"
                          >
                            {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          </span>
                          {TRANSACTION_TYPE_LABELS[txn.type] || txn.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            txn.bucket === 'CAPITAL'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {txn.bucket === 'CAPITAL' ? 'Capital' : 'Profit'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-400 max-w-72">{txn.description || '—'}</td>
                      <td className="py-3.5 px-5 font-mono text-zinc-500 whitespace-nowrap">{txn.reference}</td>
                      <td
                        className={`py-3.5 px-5 tabular-nums font-semibold text-right whitespace-nowrap ${
                          isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatINR(txn.amount)}
                        <span className="sr-only">{isCredit ? ' credit' : ' debit'}</span>
                      </td>
                      <td className="py-3.5 px-5 tabular-nums text-right text-zinc-900 dark:text-zinc-200 whitespace-nowrap">
                        {formatINR(txn.balanceAfter)}
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={txn.status} kind="transaction" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={transactions.data.meta} onPageChange={setPage} disabled={transactions.loading} />
        </>
      )}
    </>
  );
}
