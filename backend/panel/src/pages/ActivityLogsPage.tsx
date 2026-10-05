import React, { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useActivityLogs, useDebouncedValue } from '../hooks';
import { RoleBadge } from '../components/RoleBadge';
import { Pagination } from '../components/Pagination';
import { TableStateRow } from '../components/TableStateRow';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { btnRowClass, filterCardClass, selectClass, tableCardClass, theadClass, tbodyClass, trClass } from '../components/ui';
import { formatDateTime, getApiErrorMessage } from '../utils/finance';

export const ActivityLogsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading, isError, error, refetch, isFetching } = useActivityLogs({
    page,
    limit: 15,
    search: debouncedSearch || undefined,
    entity: entityFilter || undefined,
  });

  const logs = data?.logs || [];
  const hasFilters = !!(search || entityFilter);

  const clearFilters = () => {
    setSearch('');
    setEntityFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Audit trail of every admin action, sign-in and security event, with who did it and when."
        actions={<RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
      />

      <div className={`${filterCardClass} flex flex-col md:flex-row md:items-center gap-3`}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search descriptions, actions or IP addresses"
          label="Search activity logs"
          className="flex-1"
        />

        <label htmlFor="logs-entity-filter" className="sr-only">
          Entity
        </label>
        <select
          id="logs-entity-filter"
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className={`${selectClass} w-full md:w-56`}
        >
          <option value="">All entities</option>
          <option value="USER">User / account</option>
          <option value="KYC_PROFILE">KYC profile</option>
          <option value="DEPOSIT">Payment (deposit)</option>
          <option value="INVESTMENT">Investment</option>
          <option value="INVESTMENT_PLAN">Investment plan</option>
          <option value="WITHDRAWAL">Withdrawal</option>
          <option value="WALLET">Wallet adjustment</option>
          <option value="ANNOUNCEMENT">Announcement</option>
          <option value="SYSTEM_SETTING">Settings</option>
          <option value="SYSTEM">System event</option>
        </select>
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={7}
                isLoading={isLoading}
                isError={isError}
                isEmpty={logs.length === 0}
                loadingText="Loading activity logs..."
                emptyIcon={ScrollText}
                emptyTitle={hasFilters ? 'No matching activity' : 'No activity recorded yet'}
                emptyText={
                  hasFilters
                    ? 'No activity log entries match these filters.'
                    : 'Admin actions and security events are logged here automatically.'
                }
                emptyAction={
                  hasFilters ? (
                    <button type="button" onClick={clearFilters} className={btnRowClass}>
                      Clear filters
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load activity logs.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                logs.map((log) => (
                  <tr key={log.id} className={trClass}>
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">#{log.id}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-500/20 text-[11px] font-mono whitespace-nowrap">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 dark:text-slate-300 font-medium whitespace-nowrap">
                      {log.entity}
                      {log.entity_id ? <span className="text-slate-400 font-mono"> #{log.entity_id}</span> : null}
                    </td>
                    <td className="py-3.5 px-4">
                      {log.user ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-800 dark:text-slate-200 break-all">{log.user.email}</span>
                          <RoleBadge role={log.user.role} />
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">System</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.ip_address || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
};
