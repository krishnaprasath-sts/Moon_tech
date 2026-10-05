import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Eye, ShieldCheck, Ban, CheckCircle, UserPlus, TrendingUp } from 'lucide-react';
import { useCustomers, useUpdateCustomerStatus, useDebouncedValue } from '../hooks';
import { KycStatusBadge } from '../components/KycStatusBadge';
import { AccountStatusBadge } from '../components/AccountStatusBadge';
import { Pagination } from '../components/Pagination';
import { TableStateRow } from '../components/TableStateRow';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { ActionModal } from '../components/ActionModal';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CustomerSummary, KycStatus, UserStatus } from '../types';
import { btnPrimaryClass, btnRowClass, filterCardClass, selectClass, tableCardClass, theadClass, tbodyClass, trClass, numCellClass } from '../components/ui';
import { formatDate, formatINR, formatNumber, getApiErrorMessage } from '../utils/finance';

export const CustomersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kycStatusFilter, setKycStatusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusTarget, setStatusTarget] = useState<CustomerSummary | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading, isError, error, refetch, isFetching } = useCustomers({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    kycStatus: kycStatusFilter || undefined,
    status: statusFilter || undefined,
  });

  const updateStatusMutation = useUpdateCustomerStatus();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const customers = data?.customers || [];
  const hasFilters = !!(search || kycStatusFilter || statusFilter);

  const clearFilters = () => {
    setSearch('');
    setKycStatusFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const isSuspending = statusTarget?.accountStatus === UserStatus.ACTIVE;

  const handleToggleStatus = async (reason: string) => {
    if (!statusTarget) return;
    const newStatus = isSuspending ? UserStatus.SUSPENDED : UserStatus.ACTIVE;

    try {
      await updateStatusMutation.mutateAsync({
        id: statusTarget.id,
        status: newStatus,
        reason: reason || undefined,
      });
      toast.success(
        newStatus === UserStatus.SUSPENDED
          ? `${statusTarget.fullName} can no longer sign in`
          : `${statusTarget.fullName} can sign in again`,
        newStatus === UserStatus.SUSPENDED ? 'Account suspended' : 'Account activated'
      );
      setStatusTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update the account status'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Every customer account with its KYC status, active investments and access state."
        viewOnly={!isAdmin}
        actions={
          <>
            <RefreshButton onClick={() => refetch()} isFetching={isFetching} />
            {isAdmin && (
              <button type="button" onClick={() => setIsAddCustomerOpen(true)} className={btnPrimaryClass}>
                <UserPlus className="w-4 h-4" />
                Add Customer
              </button>
            )}
          </>
        }
      />

      <div className={`${filterCardClass} flex flex-col md:flex-row md:items-center gap-3`}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search name, email, phone or referral code"
          label="Search customers"
          className="flex-1"
        />

        <label htmlFor="customers-kyc-filter" className="sr-only">
          KYC status
        </label>
        <select
          id="customers-kyc-filter"
          value={kycStatusFilter}
          onChange={(e) => {
            setKycStatusFilter(e.target.value);
            setPage(1);
          }}
          className={`${selectClass} w-full md:w-48`}
        >
          <option value="">All KYC statuses</option>
          <option value={KycStatus.PENDING}>Pending review</option>
          <option value={KycStatus.UNDER_REVIEW}>Under review</option>
          <option value={KycStatus.VERIFIED}>Verified</option>
          <option value={KycStatus.REJECTED}>Rejected</option>
          <option value={KycStatus.RESUBMISSION_REQUIRED}>Resubmission required</option>
          <option value={KycStatus.DRAFT}>Not submitted</option>
        </select>

        <label htmlFor="customers-status-filter" className="sr-only">
          Account status
        </label>
        <select
          id="customers-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={`${selectClass} w-full md:w-44`}
        >
          <option value="">All account statuses</option>
          <option value={UserStatus.ACTIVE}>Active</option>
          <option value={UserStatus.SUSPENDED}>Suspended</option>
          <option value={UserStatus.INACTIVE}>Inactive</option>
        </select>
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Referral</th>
                <th className="py-3.5 px-4">KYC</th>
                <th className="py-3.5 px-4 text-right">Active Investments</th>
                <th className="py-3.5 px-4">Account</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={9}
                isLoading={isLoading}
                isError={isError}
                isEmpty={customers.length === 0}
                loadingText="Loading customers..."
                emptyIcon={Users}
                emptyTitle={hasFilters ? 'No matching customers' : 'No customers yet'}
                emptyText={
                  hasFilters
                    ? 'No customers match these filters.'
                    : 'Customers appear here once they register in the app or are added manually.'
                }
                emptyAction={
                  hasFilters ? (
                    <button type="button" onClick={clearFilters} className={btnRowClass}>
                      Clear filters
                    </button>
                  ) : isAdmin ? (
                    <button type="button" onClick={() => setIsAddCustomerOpen(true)} className={btnPrimaryClass}>
                      <UserPlus className="w-4 h-4" />
                      Add Customer
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load customers.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                customers.map((customer) => {
                  const activeCount = Number(customer.activeInvestmentsCount) || 0;
                  const isActive = customer.accountStatus === UserStatus.ACTIVE;
                  return (
                    <tr key={customer.id} className={trClass}>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">#{customer.id}</td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="font-bold text-slate-900 dark:text-white">{customer.fullName || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {[customer.city, customer.state].filter(Boolean).join(', ') || 'Location not provided'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700 dark:text-slate-300 break-all">{customer.email}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{customer.phone || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-brand-700 dark:text-brand-300 text-[11px] font-semibold">
                          {customer.referralCode || '—'}
                        </span>
                        {customer.referredBy && (
                          <div className="text-[10px] text-slate-500 mt-0.5">Referred by {customer.referredBy}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <KycStatusBadge status={customer.kycStatus} />
                      </td>
                      <td className={`py-3.5 px-4 ${numCellClass}`}>
                        {activeCount > 0 ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-sans bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <TrendingUp className="w-3 h-3" />
                              {formatNumber(activeCount)} active
                            </span>
                            {customer.activeInvestedAmount ? (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatINR(customer.activeInvestedAmount)}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-sans">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <AccountStatusBadge status={customer.accountStatus} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/customers/${customer.id}`}
                            aria-label={`View profile of ${customer.fullName || customer.email}`}
                            title="View profile"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {customer.kycId && (
                            <Link
                              to={`/kyc/${customer.kycId}`}
                              aria-label={`Open KYC of ${customer.fullName || customer.email}`}
                              title="Open KYC"
                              className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-600 hover:text-white transition"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setStatusTarget(customer)}
                              aria-label={isActive ? `Suspend ${customer.fullName || customer.email}` : `Activate ${customer.fullName || customer.email}`}
                              title={isActive ? 'Suspend account' : 'Activate account'}
                              className={`p-1.5 rounded-lg transition ${
                                isActive
                                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white'
                                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white'
                              }`}
                            >
                              {isActive ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <Pagination meta={data?.meta} onPageChange={setPage} />
      </div>

      <AddCustomerModal isOpen={isAddCustomerOpen} onClose={() => setIsAddCustomerOpen(false)} />

      <ActionModal
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onSubmit={handleToggleStatus}
        tone={isSuspending ? 'danger' : 'approve'}
        title={isSuspending ? 'Suspend Customer Account' : 'Reactivate Customer Account'}
        description={
          statusTarget && (
            <>
              {isSuspending ? 'Suspend' : 'Reactivate'} access for{' '}
              <strong className="text-slate-900 dark:text-white">{statusTarget.fullName}</strong> ({statusTarget.email})?{' '}
              {isSuspending
                ? 'They will be signed out and unable to sign in until the account is reactivated. Investments keep running.'
                : 'They will be able to sign in again immediately.'}
            </>
          )
        }
        inputLabel="Reason"
        placeholder={isSuspending ? 'e.g. Suspicious payment activity under review' : 'e.g. Verification completed'}
        confirmText={isSuspending ? 'Suspend Account' : 'Activate Account'}
        isLoading={updateStatusMutation.isPending}
      />
    </div>
  );
};
