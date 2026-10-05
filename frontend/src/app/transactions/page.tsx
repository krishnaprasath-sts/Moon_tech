"use client";

import React, { useCallback, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Filter, Receipt } from 'lucide-react';
import { api, TransactionType } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import { formatDateTime, formatINR, TRANSACTION_TYPE_LABELS } from '@/lib/format';
import {
  Alert,
  CardHeader,
  cardClass,
  chipClass,
  EmptyState,
  ErrorState,
  FullPageMessage,
  inputClass,
  labelClass,
  LoadingRows,
  PageHeader,
  PageShell,
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

export default function TransactionsPage() {
  const { token, loading: authLoading } = useAuth();
  const [type, setType] = useState<TransactionType | ''>('');
  const [draftRange, setDraftRange] = useState<DateRange>(EMPTY_RANGE);
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [rangeError, setRangeError] = useState('');
  const [page, setPage] = useState(1);

  const fetcher = useCallback(
    () => api.getTransactions(token as string, { page, limit: PAGE_SIZE, type, ...range }),
    [token, page, type, range]
  );
  const transactions = useAsyncData(token ? fetcher : null);

  if (authLoading || !token) return <FullPageMessage>Loading transactions...</FullPageMessage>;

  const hasFilters = Boolean(type || range.startDate || range.endDate);
  const rangeDirty = draftRange.startDate !== range.startDate || draftRange.endDate !== range.endDate;

  const changeType = (next: TransactionType | '') => {
    setType(next);
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
    setPage(1);
  };

  return (
    <PageShell>
      <PageHeader
        title="Transaction history"
        subtitle="Every wallet deposit, investment, profit, withdrawal, refund and adjustment on your account, with the balance after each entry."
      />

      <div className={`${cardClass} p-5 space-y-4`}>
        <div>
          <div className={labelClass}>Type</div>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter by transaction type">
            {TYPE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                role="tab"
                aria-selected={type === chip.value}
                onClick={() => changeType(chip.value)}
                className={chipClass(type === chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={applyRange} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end" noValidate>
          <div>
            <label htmlFor="filter-start" className={labelClass}>
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
            <label htmlFor="filter-end" className={labelClass}>
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
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
            <button type="submit" disabled={!rangeDirty} className={primaryButtonClass}>
              <Filter className="w-3.5 h-3.5" />
              <span>Apply dates</span>
            </button>
            <button type="button" onClick={clearFilters} disabled={!hasFilters && !rangeDirty} className={secondaryButtonClass}>
              Clear all
            </button>
          </div>
        </form>
        {rangeError && <Alert>{rangeError}</Alert>}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <CardHeader
          icon={<Receipt />}
          title="Transactions"
          action={
            transactions.data ? (
              <span className="text-[11px] text-zinc-500">
                {transactions.data.meta.total} {transactions.data.meta.total === 1 ? 'entry' : 'entries'}
              </span>
            ) : undefined
          }
        />
        {transactions.error && !transactions.data ? (
          <ErrorState message={transactions.error} onRetry={transactions.reload} />
        ) : !transactions.data ? (
          <LoadingRows rows={6} />
        ) : transactions.data.items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-4 h-4" />}
            title={hasFilters ? 'No transactions match these filters' : 'No transactions yet'}
            description={
              hasFilters
                ? 'Try a different type or date range.'
                : 'Your wallet activity will appear here once your first deposit is verified.'
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
            <div className={`overflow-x-auto transition-opacity ${transactions.loading ? 'opacity-60' : ''}`} aria-busy={transactions.loading}>
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-100 dark:border-white/[0.04]">
                  <tr>
                    <th scope="col" className="py-3 px-5">Date</th>
                    <th scope="col" className="py-3 px-5">Type</th>
                    <th scope="col" className="py-3 px-5">Description</th>
                    <th scope="col" className="py-3 px-5">Reference</th>
                    <th scope="col" className="py-3 px-5 text-right">Amount</th>
                    <th scope="col" className="py-3 px-5 text-right">Balance after</th>
                    <th scope="col" className="py-3 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                  {transactions.data.items.map((txn) => {
                    const isCredit = txn.direction === 'CREDIT';
                    return (
                      <tr key={txn.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
                        <td className="py-3.5 px-5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {formatDateTime(txn.createdAt)}
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                isCredit
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}
                              aria-hidden="true"
                            >
                              {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            </span>
                            {TRANSACTION_TYPE_LABELS[txn.type] || txn.type}
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
      </div>
    </PageShell>
  );
}
