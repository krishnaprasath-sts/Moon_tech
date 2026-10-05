import React, { useState } from 'react';
import { Eye, CheckCircle2, XCircle, CreditCard } from 'lucide-react';
import { useAdminDeposits, useApproveDeposit, useRejectDeposit, useDebouncedValue } from '../hooks';
import { financeApi } from '../api';
import { Pagination } from '../components/Pagination';
import { StatusTabs } from '../components/StatusTabs';
import { TableStateRow } from '../components/TableStateRow';
import { FinanceStatusBadge } from '../components/FinanceStatusBadge';
import { FileViewerModal } from '../components/FileViewerModal';
import { ActionModal } from '../components/ActionModal';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AdminDeposit } from '../types';
import {
  btnRowClass,
  btnDangerOutlineClass,
  filterCardClass,
  tableCardClass,
  theadClass,
  tbodyClass,
  trClass,
  numCellClass,
} from '../components/ui';
import { formatINR, formatDateTime, getApiErrorMessage } from '../utils/finance';

const TABS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All Payments' },
];

const EMPTY_TEXT: Record<string, string> = {
  PENDING: 'There are no payments waiting for verification. New UPI submissions appear here as customers upload receipts.',
  APPROVED: 'No approved payments match these filters.',
  REJECTED: 'No rejected payments match these filters.',
  ALL: 'No payment submissions match these filters.',
};

export const PaymentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  // Default to the pending queue - these are the payments waiting for verification
  const [activeTab, setActiveTab] = useState<string>('PENDING');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const [receiptDeposit, setReceiptDeposit] = useState<AdminDeposit | null>(null);
  const [approvingDeposit, setApprovingDeposit] = useState<AdminDeposit | null>(null);
  const [rejectingDeposit, setRejectingDeposit] = useState<AdminDeposit | null>(null);

  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminDeposits({
    page,
    limit: 10,
    status: activeTab === 'ALL' ? undefined : activeTab,
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const approveMutation = useApproveDeposit();
  const rejectMutation = useRejectDeposit();

  // meta.counts is lowercase for deposits: { pending, approved, rejected }
  const counts = data?.counts;
  const hasCounts = !!counts && Object.keys(counts).length > 0;
  const tabs = TABS.map((tab) =>
    tab.id === 'ALL'
      ? { ...tab, count: hasCounts ? (counts.pending || 0) + (counts.approved || 0) + (counts.rejected || 0) : undefined }
      : { ...tab, count: counts?.[tab.id.toLowerCase()] }
  );

  const deposits = data?.deposits || [];
  const hasFilters = !!(search || startDate || endDate);

  const clearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleApprove = async (remarks: string) => {
    if (!approvingDeposit) return;
    try {
      const res = await approveMutation.mutateAsync({ id: approvingDeposit.id, remarks: remarks || undefined });
      const balance = res.data?.walletBalance;
      toast.success(
        `${formatINR(approvingDeposit.amount)} credited to ${approvingDeposit.customerName || 'the customer'}'s wallet${
          typeof balance === 'number' ? `. New balance: ${formatINR(balance)}` : ''
        }`,
        'Payment approved'
      );
      setApprovingDeposit(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to approve the payment'));
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectingDeposit) return;
    try {
      await rejectMutation.mutateAsync({ id: rejectingDeposit.id, reason });
      toast.success(`${rejectingDeposit.reference} has been rejected. The customer will see the reason.`, 'Payment rejected');
      setRejectingDeposit(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to reject the payment'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Verify UPI top-up submissions against their receipts. A wallet is credited only after approval."
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
          placeholder="Search reference, UPI transaction ID, customer name, email or phone"
          label="Search payments"
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
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4">UPI Transaction ID</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={7}
                isLoading={isLoading}
                isError={isError}
                isEmpty={deposits.length === 0}
                loadingText="Loading payment submissions..."
                emptyIcon={CreditCard}
                emptyTitle={hasFilters ? 'No matching payments' : 'No payments here'}
                emptyText={EMPTY_TEXT[activeTab] || EMPTY_TEXT.ALL}
                emptyAction={
                  hasFilters ? (
                    <button type="button" onClick={clearFilters} className={btnRowClass}>
                      Clear filters
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load payment submissions.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                deposits.map((deposit) => (
                  <tr key={deposit.id} className={trClass}>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {deposit.reference}
                    </td>
                    <td className="py-3.5 px-4 min-w-[180px]">
                      <div className="font-bold text-slate-900 dark:text-white">{deposit.customerName || 'Customer'}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{deposit.customerEmail}</div>
                      {deposit.customerPhone && (
                        <div className="text-[11px] font-mono text-slate-400">{deposit.customerPhone}</div>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                      {formatINR(deposit.amount)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 break-all">
                      {deposit.upiTransactionId}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(deposit.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <FinanceStatusBadge status={deposit.status} />
                      {deposit.status === 'REJECTED' && deposit.rejectionReason && (
                        <div
                          className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-[180px] truncate"
                          title={deposit.rejectionReason}
                        >
                          {deposit.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {deposit.hasReceipt && (
                          <button type="button" onClick={() => setReceiptDeposit(deposit)} className={btnRowClass}>
                            <Eye className="w-3.5 h-3.5" />
                            Receipt
                          </button>
                        )}

                        {isAdmin && deposit.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setApprovingDeposit(deposit)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingDeposit(deposit)}
                              className={`${btnDangerOutlineClass} px-2.5 py-1.5 rounded-lg font-semibold`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={data?.meta} onPageChange={setPage} />
      </div>

      <FileViewerModal
        isOpen={!!receiptDeposit}
        onClose={() => setReceiptDeposit(null)}
        url={receiptDeposit ? financeApi.getDepositReceiptPath(receiptDeposit.id) : null}
        title={`Payment Receipt - ${receiptDeposit?.reference || ''}`}
        subtitle={
          receiptDeposit
            ? `${receiptDeposit.customerName || receiptDeposit.customerEmail || 'Customer'} • ${formatINR(
                receiptDeposit.amount
              )} • UPI Txn ${receiptDeposit.upiTransactionId}`
            : undefined
        }
        downloadName={`receipt_${receiptDeposit?.reference || 'payment'}`}
      />

      <ActionModal
        isOpen={!!approvingDeposit}
        onClose={() => setApprovingDeposit(null)}
        onSubmit={handleApprove}
        title="Approve Payment"
        description={
          approvingDeposit && (
            <>
              Approving will credit{' '}
              <strong className="text-slate-900 dark:text-white">{formatINR(approvingDeposit.amount)}</strong> to the
              wallet of{' '}
              <strong className="text-slate-900 dark:text-white">
                {approvingDeposit.customerName || approvingDeposit.customerEmail}
              </strong>
              . Confirm that UPI transaction{' '}
              <span className="font-mono font-semibold">{approvingDeposit.upiTransactionId}</span> matches the receipt
              and your bank statement. This cannot be undone.
            </>
          )
        }
        inputLabel="Remarks"
        placeholder="e.g. Amount verified against bank statement."
        confirmText="Approve & Credit Wallet"
        isLoading={approveMutation.isPending}
      />

      <ActionModal
        isOpen={!!rejectingDeposit}
        onClose={() => setRejectingDeposit(null)}
        onSubmit={handleReject}
        tone="danger"
        title="Reject Payment"
        subtitle="The rejection reason is shown to the customer"
        description={
          rejectingDeposit && (
            <>
              Payment <span className="font-mono font-semibold">{rejectingDeposit.reference}</span> of{' '}
              <strong className="text-slate-900 dark:text-white">{formatINR(rejectingDeposit.amount)}</strong> will be
              rejected and the wallet will not be credited.
            </>
          )
        }
        inputLabel="Rejection reason"
        placeholder="e.g. UPI transaction ID not found in bank statement."
        minLength={5}
        presets={[
          'UPI transaction ID not found in our bank statement',
          'Receipt amount does not match the submitted amount',
          'Receipt image is unreadable or incomplete',
          'Duplicate submission of an already credited payment',
        ]}
        confirmText="Confirm Rejection"
        isLoading={rejectMutation.isPending}
      />
    </div>
  );
};
