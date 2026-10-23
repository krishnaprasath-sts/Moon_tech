import React, { useState } from 'react';
import { Eye, Banknote } from 'lucide-react';
import { useAdminWithdrawals, useDebouncedValue } from '../hooks';
import { Pagination } from '../components/Pagination';
import { StatusTabs } from '../components/StatusTabs';
import { TableStateRow } from '../components/TableStateRow';
import { FinanceStatusBadge } from '../components/FinanceStatusBadge';
import { WithdrawalDetailModal } from '../components/WithdrawalDetailModal';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import { WithdrawalStatus } from '../types';
import { btnRowClass, filterCardClass, tableCardClass, theadClass, tbodyClass, trClass, numCellClass } from '../components/ui';
import { formatINR, formatDateTime, getApiErrorMessage } from '../utils/finance';

const STATUS_TABS: Array<{ id: WithdrawalStatus; label: string }> = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved - Awaiting Payout' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'REJECTED', label: 'Rejected' },
];

const EMPTY_TEXT: Record<string, string> = {
  PENDING: 'No withdrawal requests are waiting for a decision.',
  APPROVED: 'No approved withdrawals are waiting to be paid out.',
  COMPLETED: 'No completed withdrawals match these filters.',
  REJECTED: 'No rejected withdrawals match these filters.',
  ALL: 'No withdrawal requests match these filters.',
};

export const WithdrawalsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { isAdmin } = useAuth();

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminWithdrawals({
    page,
    limit: 10,
    status: activeTab === 'ALL' ? undefined : activeTab,
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // meta.counts is keyed by upper-case status for withdrawals
  const counts = data?.counts;
  const hasCounts = !!counts && Object.keys(counts).length > 0;
  const tabs = [
    {
      id: 'ALL',
      label: 'All Requests',
      count: hasCounts ? Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0) : undefined,
    },
    ...STATUS_TABS.map((tab) => ({ ...tab, count: counts?.[tab.id] })),
  ];

  const withdrawals = data?.withdrawals || [];
  const hasFilters = !!(search || startDate || endDate);

  const clearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        description="Review withdrawal requests, approve them, send the payout and record the payment proof."
        viewOnly={!isAdmin}
        actions={<RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
      />

      <StatusTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setPage(1);
        }}
      />

      <div className={`${filterCardClass} flex flex-col md:flex-row md:items-center gap-3`}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search reference, customer name, email or phone"
          label="Search withdrawals"
          className="flex-1"
        />
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
            setPage(1);
          }}
        />
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">Reference</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Source</th>
                <th className="py-3.5 px-4 text-right">Gross</th>
                <th className="py-3.5 px-4 text-right">Fee</th>
                <th className="py-3.5 px-4 text-right">Net Payable</th>
                <th className="py-3.5 px-4">Payout</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Requested</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={10}
                isLoading={isLoading}
                isError={isError}
                isEmpty={withdrawals.length === 0}
                loadingText="Loading withdrawal requests..."
                emptyIcon={Banknote}
                emptyTitle={hasFilters ? 'No matching requests' : 'Queue is clear'}
                emptyText={EMPTY_TEXT[activeTab] || EMPTY_TEXT.ALL}
                emptyAction={
                  hasFilters ? (
                    <button type="button" onClick={clearFilters} className={btnRowClass}>
                      Clear filters
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load withdrawal requests.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                withdrawals.map((w) => {
                  const needsAction = isAdmin && (w.status === 'PENDING' || w.status === 'APPROVED');
                  return (
                    <tr key={w.id} className={trClass}>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {w.reference}
                        {w.isEarly && w.source !== 'WALLET' && (
                          <div className="text-[10px] font-sans font-bold text-amber-600 dark:text-amber-400">
                            Before maturity
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="font-bold text-slate-900 dark:text-white">{w.customerName || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{w.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {w.source === 'WALLET' ? (
                          <>
                            <div
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${
                                w.bucket === 'CAPITAL'
                                  ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                              }`}
                            >
                              {w.bucket === 'CAPITAL' ? 'Capital wallet' : 'Profit wallet'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Amount already reserved</div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{w.investmentReference}</div>
                            <div className="text-[10px] text-slate-400">{w.planName} · capital</div>
                          </>
                        )}
                      </td>
                      <td className={`py-3.5 px-4 text-slate-700 dark:text-slate-300 ${numCellClass}`}>
                        {formatINR(w.totalAmount)}
                        {Number(w.profitAmount) > 0 && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">incl. +{formatINR(w.profitAmount)} profit</div>
                        )}
                      </td>
                      <td className={`py-3.5 px-4 font-bold text-rose-600 dark:text-rose-400 ${numCellClass}`}>
                        {Number(w.feeAmount) > 0 ? `-${formatINR(w.feeAmount)}` : '—'}
                        {Number(w.feeAmount) > 0 && <div className="text-[10px] font-normal text-slate-400">{w.feePercent}%</div>}
                      </td>
                      <td className={`py-3.5 px-4 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                        {formatINR(w.netAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{w.payoutMethod}</span>
                        <div className="text-[10px] font-mono text-slate-400 break-all">
                          {(w.payoutMethod === 'UPI' ? w.payoutUpiId : w.payoutAccountMasked) || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <FinanceStatusBadge status={w.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(w.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(w.id)}
                          className={
                            needsAction
                              ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition whitespace-nowrap'
                              : btnRowClass
                          }
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {needsAction ? (w.status === 'PENDING' ? 'Review' : 'Process Payout') : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <Pagination meta={data?.meta} onPageChange={setPage} />
      </div>

      <WithdrawalDetailModal withdrawalId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
};
