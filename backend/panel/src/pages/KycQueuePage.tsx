import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Plus, ShieldCheck } from 'lucide-react';
import { useKycList, useDebouncedValue } from '../hooks';
import { KycStatusBadge } from '../components/KycStatusBadge';
import { Pagination } from '../components/Pagination';
import { StatusTabs } from '../components/StatusTabs';
import { TableStateRow } from '../components/TableStateRow';
import { AddManualKycModal } from '../components/AddManualKycModal';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import { KycStatus } from '../types';
import { btnPrimaryClass, btnRowClass, filterCardClass, tableCardClass, theadClass, tbodyClass, trClass } from '../components/ui';
import { formatDateTime, getApiErrorMessage } from '../utils/finance';

export const KycQueuePage: React.FC = () => {
  const [page, setPage] = useState(1);
  // Default to the pending queue so verified / rejected applications do not crowd the active work
  const [activeTab, setActiveTab] = useState<string>(KycStatus.PENDING);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isManualKycOpen, setIsManualKycOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { isAdmin } = useAuth();

  const { data, isLoading, isError, error, refetch, isFetching } = useKycList({
    page,
    limit: 10,
    status: activeTab === 'ALL' ? undefined : activeTab,
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const counts = data?.counts;
  const tabs = [
    { id: KycStatus.PENDING, label: 'Pending Review', count: counts?.pending },
    { id: KycStatus.VERIFIED, label: 'Verified', count: counts?.verified },
    { id: KycStatus.REJECTED, label: 'Rejected', count: counts?.rejected },
    { id: KycStatus.RESUBMISSION_REQUIRED, label: 'Resubmission', count: counts?.resubmission },
    { id: 'ALL', label: 'All Applications', count: counts?.all },
  ];

  const submissions = data?.kycSubmissions || [];
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
        title="KYC Queue"
        description="Review customer identity and bank details before they can withdraw. Verified KYC is required when the setting is enabled."
        viewOnly={!isAdmin}
        actions={
          <>
            <RefreshButton onClick={() => refetch()} isFetching={isFetching} />
            {isAdmin && (
              <button type="button" onClick={() => setIsManualKycOpen(true)} className={btnPrimaryClass}>
                <Plus className="w-3.5 h-3.5" />
                Add KYC Manually
              </button>
            )}
          </>
        }
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
          placeholder="Search customer name, email, phone or referral code"
          label="Search KYC applications"
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
                <th className="py-3.5 px-4">KYC ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">PAN</th>
                <th className="py-3.5 px-4">Bank Account</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4">Reviewed By</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={8}
                isLoading={isLoading}
                isError={isError}
                isEmpty={submissions.length === 0}
                loadingText="Loading KYC queue..."
                emptyIcon={ShieldCheck}
                emptyTitle={hasFilters ? 'No matching applications' : 'Queue is clear'}
                emptyText={
                  hasFilters
                    ? 'No KYC applications match these filters.'
                    : activeTab === KycStatus.PENDING
                    ? 'There are no KYC applications waiting for review.'
                    : 'No KYC applications in this tab.'
                }
                emptyAction={
                  hasFilters ? (
                    <button type="button" onClick={clearFilters} className={btnRowClass}>
                      Clear filters
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load the KYC queue.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                submissions.map((kyc) => {
                  const isPendingReview =
                    kyc.status === KycStatus.PENDING ||
                    kyc.status === KycStatus.UNDER_REVIEW ||
                    kyc.status === KycStatus.RESUBMISSION_REQUIRED;
                  return (
                    <tr key={kyc.id} className={trClass}>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">#{kyc.id}</td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="font-bold text-slate-900 dark:text-white">{kyc.customerName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{kyc.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {kyc.panMasked || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {kyc.bankAccountMasked || '—'}
                        {kyc.ifscCode && <div className="text-[10px] text-slate-400 dark:text-slate-500">{kyc.ifscCode}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <KycStatusBadge status={kyc.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(kyc.submittedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 break-all">
                        {kyc.reviewedBy ? kyc.reviewedBy.email : <span className="text-slate-400 dark:text-slate-600">Not reviewed</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/kyc/${kyc.id}`}
                          className={
                            isPendingReview && isAdmin
                              ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition whitespace-nowrap'
                              : btnRowClass
                          }
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {isPendingReview && isAdmin ? 'Review' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <Pagination meta={data?.meta} onPageChange={setPage} />
      </div>

      {isAdmin && <AddManualKycModal isOpen={isManualKycOpen} onClose={() => setIsManualKycOpen(false)} />}
    </div>
  );
};
