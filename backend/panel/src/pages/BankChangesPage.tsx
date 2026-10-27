import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, Landmark, AlertTriangle } from 'lucide-react';
import { useBankChangeRequests, useDebouncedValue } from '../hooks';
import { Pagination } from '../components/Pagination';
import { StatusTabs } from '../components/StatusTabs';
import { TableStateRow } from '../components/TableStateRow';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { BankChangeReviewModal, BankChangeStatusChip } from '../components/BankChangeReviewModal';
import { useAuth } from '../context/AuthContext';
import { BankChangeStatus } from '../types';
import { btnRowClass, filterCardClass, tableCardClass, theadClass, tbodyClass, trClass } from '../components/ui';
import { formatDateTime, getApiErrorMessage } from '../utils/finance';

const EMPTY_TEXT: Record<string, string> = {
  PENDING: 'No bank account change requests are waiting for review.',
  APPROVED: 'No approved bank account changes yet.',
  REJECTED: 'No rejected bank account changes.',
  ALL: 'No bank account change requests yet.',
};

export const BankChangesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'PENDING');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const { isAdmin } = useAuth();

  // ?request=<id> deep-links straight into the review dialog (used from the withdrawal bank check)
  const requestParam = Number(searchParams.get('request'));
  const selectedId = Number.isInteger(requestParam) && requestParam > 0 ? requestParam : null;
  const setSelectedId = (id: number | null) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('request', String(id));
      else next.delete('request');
      return next;
    });

  const { data, isLoading, isError, error, refetch, isFetching } = useBankChangeRequests({
    page,
    limit: 10,
    status: activeTab === 'ALL' ? undefined : (activeTab as BankChangeStatus),
    search: debouncedSearch || undefined,
  });

  const requests = data?.requests || [];
  const pendingCount = data?.meta?.pendingCount;
  const tabs = [
    { id: 'PENDING', label: 'Pending', count: pendingCount },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
    { id: 'ALL', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Changes"
        description="Customers cannot edit their payout bank account directly. Verify the proof and approve or reject each change request before money goes to a new account."
        viewOnly={!isAdmin}
        actions={<RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
      />

      <StatusTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setPage(1);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (id === 'PENDING') next.delete('tab');
            else next.set('tab', id);
            return next;
          });
        }}
      />

      <div className={filterCardClass}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search customer name, customer ID, email or phone"
          label="Search bank change requests"
        />
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">Request</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Current account → Requested account</th>
                <th className="py-3.5 px-4">Requested</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={6}
                isLoading={isLoading}
                isError={isError}
                isEmpty={requests.length === 0}
                loadingText="Loading bank change requests..."
                emptyIcon={Landmark}
                emptyTitle={search ? 'No matching requests' : activeTab === 'PENDING' ? 'Queue is clear' : 'Nothing here'}
                emptyText={search ? 'No bank change requests match this search.' : EMPTY_TEXT[activeTab] || EMPTY_TEXT.ALL}
                emptyAction={
                  search ? (
                    <button type="button" onClick={() => setSearch('')} className={btnRowClass}>
                      Clear search
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load bank change requests.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                requests.map((r) => {
                  const needsAction = isAdmin && r.status === 'PENDING';
                  return (
                    <tr key={r.id} className={trClass}>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        #{r.id}
                      </td>
                      <td className="py-3.5 px-4 min-w-[170px]">
                        <div className="font-bold text-slate-900 dark:text-white">{r.customer.name}</div>
                        {r.customer.customerId && (
                          <div className="text-[10px] font-mono text-slate-400">{r.customer.customerId}</div>
                        )}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{r.customer.email}</div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[300px]">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {r.previous?.accountNumberMasked || 'None'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{r.previous?.bankName || '—'}</div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-label="changes to" />
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {r.requested.accountNumberMasked || '—'}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                              {r.requested.bankName || '—'}
                            </div>
                          </div>
                        </div>
                        {r.holderNameChanged && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Holder name changed
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <BankChangeStatusChip status={r.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className={
                            needsAction
                              ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition whitespace-nowrap'
                              : btnRowClass
                          }
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {needsAction ? 'Review' : 'View'}
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

      <BankChangeReviewModal requestId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
};
