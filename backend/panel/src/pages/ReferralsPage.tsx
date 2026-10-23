import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { useReferrals, useDebouncedValue } from '../hooks';
import { KycStatusBadge } from '../components/KycStatusBadge';
import { AccountStatusBadge } from '../components/AccountStatusBadge';
import { Pagination } from '../components/Pagination';
import { TableStateRow } from '../components/TableStateRow';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { btnRowClass, filterCardClass, tableCardClass, theadClass, tbodyClass, trClass } from '../components/ui';
import { formatDate, formatINR, getApiErrorMessage } from '../utils/finance';

export const ReferralsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading, isError, error, refetch, isFetching } = useReferrals({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
  });

  const referrals = data?.referrals || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        description="Who invited whom: every referral link between customers with the referred customer's KYC and account status."
        actions={<RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
      />

      <div className={filterCardClass}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by referral code"
          label="Search referrals"
        />
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Referrer</th>
                <th className="py-3.5 px-4">Referred Customer</th>
                <th className="py-3.5 px-4">Referral Code</th>
                <th className="py-3.5 px-4">Referred KYC</th>
                <th className="py-3.5 px-4">Referred Account</th>
                <th className="py-3.5 px-4 text-right">Commission</th>
                <th className="py-3.5 px-4">Linked</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={8}
                isLoading={isLoading}
                isError={isError}
                isEmpty={referrals.length === 0}
                loadingText="Loading referrals..."
                emptyIcon={Network}
                emptyTitle={search ? 'No matching referrals' : 'No referrals yet'}
                emptyText={
                  search
                    ? 'No referral links match this code.'
                    : 'Referral links appear here when a customer signs up with another customer’s referral code.'
                }
                emptyAction={
                  search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setPage(1);
                      }}
                      className={btnRowClass}
                    >
                      Clear search
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load referrals.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                referrals.map((ref) => (
                  <tr key={ref.id} className={trClass}>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">#{ref.id}</td>
                    <td className="py-3.5 px-4 min-w-[160px]">
                      <Link
                        to={`/customers/${ref.referrer.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {ref.referrer.name}
                      </Link>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{ref.referrer.email}</div>
                    </td>
                    <td className="py-3.5 px-4 min-w-[160px]">
                      <Link
                        to={`/customers/${ref.referred.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {ref.referred.name}
                      </Link>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{ref.referred.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-300 font-bold text-[11px]">
                        {ref.referralCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <KycStatusBadge status={ref.referred.kycStatus} />
                    </td>
                    <td className="py-3.5 px-4">
                      <AccountStatusBadge status={ref.referred.accountStatus} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatINR(ref.commissionEarned ?? 0)}
                      </div>
                      {Number(ref.commissionPending) > 0 && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">{formatINR(ref.commissionPending)} pending</div>
                      )}
                      {Number(ref.commissionCount) === 0 && <div className="text-[10px] text-slate-400">No investments yet</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(ref.createdAt)}</td>
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
