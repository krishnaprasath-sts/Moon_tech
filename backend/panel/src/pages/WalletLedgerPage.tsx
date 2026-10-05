import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { useWalletLedger, useDebouncedValue } from '../hooks';
import { Pagination } from '../components/Pagination';
import { TableStateRow } from '../components/TableStateRow';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { WalletTxnType } from '../types';
import { btnRowClass, filterCardClass, selectClass, tableCardClass, theadClass, tbodyClass, trClass, numCellClass } from '../components/ui';
import { formatINR, formatDateTime, getApiErrorMessage, humanize } from '../utils/finance';

const TRANSACTION_TYPES: WalletTxnType[] = [
  'DEPOSIT',
  'INVESTMENT',
  'MATURITY_PRINCIPAL',
  'PROFIT',
  'WITHDRAWAL',
  'REFUND',
  'ADJUSTMENT',
];

export const WalletLedgerPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [direction, setDirection] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading, isError, error, refetch, isFetching } = useWalletLedger({
    page,
    limit: 15,
    search: debouncedSearch || undefined,
    type: type || undefined,
    direction: direction || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const transactions = data?.transactions || [];
  const hasFilters = !!(search || type || direction || startDate || endDate);

  const clearFilters = () => {
    setSearch('');
    setType('');
    setDirection('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet Ledger"
        description="Immutable record of every wallet credit and debit across the platform, with the balance before and after."
        actions={<RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
      />

      <div className={`${filterCardClass} space-y-3`}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search transaction reference, customer name, email or phone"
          label="Search wallet ledger"
        />

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="ledger-type" className="sr-only">
            Transaction type
          </label>
          <select
            id="ledger-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </select>

          <label htmlFor="ledger-direction" className="sr-only">
            Direction
          </label>
          <select
            id="ledger-direction"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">Credit & debit</option>
            <option value="CREDIT">Credit only</option>
            <option value="DEBIT">Debit only</option>
          </select>

          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setPage(1);
            }}
          />

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">Reference</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-right">Balance Before</th>
                <th className="py-3.5 px-4 text-right">Balance After</th>
                <th className="py-3.5 px-4">Description</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={8}
                isLoading={isLoading}
                isError={isError}
                isEmpty={transactions.length === 0}
                loadingText="Loading wallet ledger..."
                emptyIcon={Wallet}
                emptyTitle={hasFilters ? 'No matching transactions' : 'No wallet activity yet'}
                emptyText={
                  hasFilters
                    ? 'No wallet transactions match these filters.'
                    : 'Ledger entries are written automatically whenever a wallet is credited or debited.'
                }
                emptyAction={
                  hasFilters ? (
                    <button type="button" onClick={clearFilters} className={btnRowClass}>
                      Clear filters
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load wallet transactions.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                transactions.map((txn) => {
                  const isCredit = txn.direction === 'CREDIT';
                  return (
                    <tr key={txn.id} className={trClass}>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {txn.reference}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(txn.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <Link
                          to={`/customers/${txn.userId}`}
                          className="font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          {txn.customerName || `Customer #${txn.userId}`}
                        </Link>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{txn.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                          {humanize(txn.type)}
                        </span>
                      </td>
                      <td
                        className={`py-3.5 px-4 font-bold ${numCellClass} ${
                          isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          {isCredit ? '+' : '-'}
                          {formatINR(txn.amount)}
                        </span>
                        <div className="text-[10px] font-sans font-semibold uppercase opacity-80">
                          {isCredit ? 'Credit' : 'Debit'}
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 text-slate-500 dark:text-slate-400 ${numCellClass}`}>
                        {formatINR(txn.balanceBefore)}
                      </td>
                      <td className={`py-3.5 px-4 font-semibold text-slate-900 dark:text-white ${numCellClass}`}>
                        {formatINR(txn.balanceAfter)}
                      </td>
                      <td
                        className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[260px] truncate"
                        title={txn.description || undefined}
                      >
                        {txn.description || '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <Pagination meta={data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
};
