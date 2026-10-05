import React, { useState } from 'react';
import { Eye, Clock, CalendarClock, TrendingUp } from 'lucide-react';
import { useAdminInvestments, useInvestmentPlans, useDebouncedValue } from '../hooks';
import { Pagination } from '../components/Pagination';
import { StatusTabs } from '../components/StatusTabs';
import { TableStateRow } from '../components/TableStateRow';
import { FinanceStatusBadge } from '../components/FinanceStatusBadge';
import { InvestmentDetailModal } from '../components/InvestmentDetailModal';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import { InvestmentStatus } from '../types';
import {
  btnRowClass,
  filterCardClass,
  selectClass,
  tableCardClass,
  theadClass,
  tbodyClass,
  trClass,
  numCellClass,
} from '../components/ui';
import { formatINR, formatDate, getApiErrorMessage } from '../utils/finance';

const STATUS_TABS: Array<{ id: InvestmentStatus; label: string }> = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'MATURED', label: 'Matured' },
  { id: 'WITHDRAWAL_REQUESTED', label: 'Withdrawal Requested' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const MATURITY_FILTERS = [
  { days: 7, label: 'Maturing in 7 days' },
  { days: 30, label: 'Maturing in 30 days' },
];

export const InvestmentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [maturingInDays, setMaturingInDays] = useState<number | null>(null);
  const [planId, setPlanId] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { isAdmin } = useAuth();
  const { data: plans = [] } = useInvestmentPlans();

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminInvestments({
    page,
    limit: 10,
    // The maturity monitor always looks at ACTIVE investments, so the status tab is ignored while it is on
    status: maturingInDays || activeTab === 'ALL' ? undefined : activeTab,
    maturingInDays: maturingInDays || undefined,
    planId: planId ? Number(planId) : undefined,
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // meta.counts is keyed by upper-case status for investments
  const counts = data?.counts;
  const hasCounts = !!counts && Object.keys(counts).length > 0;
  const tabs = [
    {
      id: 'ALL',
      label: 'All Investments',
      count: hasCounts ? Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0) : undefined,
    },
    ...STATUS_TABS.map((tab) => ({ ...tab, count: counts?.[tab.id] })),
  ];

  const investments = data?.investments || [];
  const hasFilters = !!(search || planId || startDate || endDate || maturingInDays);

  const clearFilters = () => {
    setSearch('');
    setPlanId('');
    setStartDate('');
    setEndDate('');
    setMaturingInDays(null);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="Monitor every customer investment, its maturity date and the profit it will pay."
        viewOnly={!isAdmin}
        actions={<RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
      />

      <StatusTabs
        tabs={tabs}
        activeTab={maturingInDays ? '' : activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setMaturingInDays(null);
          setPage(1);
        }}
      />

      <div className={`${filterCardClass} space-y-3`}>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search reference, plan, customer name, email or phone"
            label="Search investments"
            className="flex-1"
          />
          <label htmlFor="investment-plan-filter" className="sr-only">
            Plan
          </label>
          <select
            id="investment-plan-filter"
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              setPage(1);
            }}
            className={`${selectClass} w-full md:w-48`}
          >
            <option value="">All plans</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setPage(1);
            }}
          />

          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            {MATURITY_FILTERS.map((filter) => {
              const isActive = maturingInDays === filter.days;
              return (
                <button
                  key={filter.days}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setMaturingInDays(isActive ? null : filter.days);
                    setPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40'
                      : 'bg-slate-50 dark:bg-[#000000] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-amber-500/40'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  {filter.label}
                </button>
              );
            })}
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
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">Reference</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-right">Expected Profit</th>
                <th className="py-3.5 px-4 text-right">Maturity Amount</th>
                <th className="py-3.5 px-4">Start</th>
                <th className="py-3.5 px-4">Maturity</th>
                <th className="py-3.5 px-4">Progress</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={11}
                isLoading={isLoading}
                isError={isError}
                isEmpty={investments.length === 0}
                loadingText="Loading investments..."
                emptyIcon={TrendingUp}
                emptyTitle={maturingInDays ? 'Nothing maturing soon' : 'No investments found'}
                emptyText={
                  maturingInDays
                    ? `No active investments are maturing in the next ${maturingInDays} days.`
                    : hasFilters
                    ? 'No investments match these filters.'
                    : 'Investments appear here as soon as customers invest from their wallet.'
                }
                emptyAction={
                  hasFilters ? (
                    <button type="button" onClick={clearFilters} className={btnRowClass}>
                      Clear filters
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load investments.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                investments.map((inv) => {
                  const progress = Math.min(100, Math.max(0, Number(inv.progressPercent) || 0));
                  const isActive = inv.status === 'ACTIVE';
                  return (
                    <tr key={inv.id} className={trClass}>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {inv.reference}
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="font-bold text-slate-900 dark:text-white">{inv.customerName || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{inv.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{inv.planName}</div>
                        <div className="text-[10px] text-slate-400 whitespace-nowrap">
                          {inv.profitType === 'PERCENTAGE' ? `${inv.profitValue}%` : `${formatINR(inv.profitValue)} fixed`} •{' '}
                          {inv.durationDays}d
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                        {formatINR(inv.amount)}
                      </td>
                      <td className={`py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 ${numCellClass}`}>
                        +{formatINR(inv.expectedProfit)}
                      </td>
                      <td className={`py-3.5 px-4 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                        {formatINR(inv.maturityAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(inv.startDate)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {formatDate(inv.maturityDate)}
                      </td>
                      <td className="py-3.5 px-4 min-w-[140px]">
                        {isActive ? (
                          <>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-brand-500" />
                                {inv.daysRemaining}d left
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">{progress}%</span>
                            </div>
                            <div
                              className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={progress}
                              aria-label="Maturity progress"
                            >
                              <div
                                className="bg-gradient-to-r from-brand-500 to-blue-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <FinanceStatusBadge status={inv.status} />
                        {isActive && inv.earlyWithdrawalAllowed && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 whitespace-nowrap">
                            Early withdrawal allowed
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button type="button" onClick={() => setSelectedId(inv.id)} className={btnRowClass}>
                          <Eye className="w-3.5 h-3.5" />
                          {isAdmin && isActive ? 'Manage' : 'View'}
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

      <InvestmentDetailModal investmentId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
};
