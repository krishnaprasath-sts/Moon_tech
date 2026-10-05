import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { useCustomerFinance } from '../hooks/useFinance';
import { FinanceStatusBadge } from './FinanceStatusBadge';
import { WalletAdjustModal } from './WalletAdjustModal';
import { useAuth } from '../context/AuthContext';
import { ErrorState, ViewOnlyNote, btnSecondaryClass, numCellClass, theadClass, tbodyClass, trClass } from './ui';
import { formatINR, formatDate, formatDateTime, formatNumber, getApiErrorMessage, humanize } from '../utils/finance';

interface CustomerFinanceSectionProps {
  customerId: number | string;
  customerName: string;
}

export const CustomerFinanceSection: React.FC<CustomerFinanceSectionProps> = ({ customerId, customerName }) => {
  const { isAdmin } = useAuth();
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  const { data: finance, isLoading, isError, error, refetch } = useCustomerFinance(customerId);

  const payout = finance?.payoutDetails;

  const summaryItems = finance
    ? [
        { label: 'Invested (Active)', value: formatINR(finance.summary.investedAmount) },
        { label: 'Expected Profit', value: formatINR(finance.summary.expectedProfit) },
        { label: 'Total Deposited', value: formatINR(finance.summary.totalDeposited) },
        { label: 'Total Profit Paid', value: formatINR(finance.summary.totalProfitPaid) },
        { label: 'Total Withdrawn', value: formatINR(finance.summary.totalWithdrawn) },
        { label: 'Investments', value: formatNumber(finance.summary.investmentsCount) },
      ]
    : [];

  return (
    <div className="bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm dark:shadow-xl space-y-5 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Wallet & Investments</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Wallet balance, investment history and recent wallet transactions
            </p>
          </div>
        </div>

        {finance &&
          (isAdmin ? (
            <button type="button" onClick={() => setIsAdjustOpen(true)} className={btnSecondaryClass}>
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-500" />
              <span>Adjust wallet</span>
            </button>
          ) : (
            <ViewOnlyNote />
          ))}
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse" role="status" aria-label="Loading wallet">
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      ) : isError || !finance ? (
        <ErrorState
          message={getApiErrorMessage(error, 'Failed to load wallet and investments.')}
          onRetry={() => refetch()}
          className="py-6"
        />
      ) : (
        <>
          {/* Wallet balance & summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-tr from-brand-600 to-blue-600 text-white shadow-lg shadow-brand-500/20">
              <p className="text-[11px] uppercase font-semibold tracking-wider text-white/80">Wallet Balance</p>
              <p className="text-2xl font-black font-mono tabular-nums mt-1 break-words">{formatINR(finance.walletBalance)}</p>
              <p className="text-[11px] text-white/80 mt-2">
                {formatNumber(finance.summary.recentCreditsCount)} recent credit
                {Number(finance.summary.recentCreditsCount) === 1 ? '' : 's'}
              </p>
            </div>

            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80"
                >
                  <span className="text-slate-500 block text-[11px] uppercase">{item.label}</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white break-words">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payout details */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
            <h3 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Registered Payout Details
            </h3>
            {payout ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase">Preferred</span>
                  <span className="font-bold text-slate-900 dark:text-white">{payout.preferredMethod}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase">UPI ID</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 break-all">{payout.upiId || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase">Account Holder</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{payout.accountHolderName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase">Account Number</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{payout.accountNumberMasked || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase">IFSC</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{payout.ifscCode || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase">Bank</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{payout.bankName || '—'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">This customer has not registered bank or UPI payout details yet.</p>
            )}
          </div>

          {/* Investments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Investment History ({finance.investments.length})
              </h3>
              <Link
                to="/investments"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                All investments
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            {finance.investments.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800/80">
                This customer has not made any investments yet.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className={theadClass}>
                    <tr>
                      <th className="py-3 px-3.5">Reference</th>
                      <th className="py-3 px-3.5">Plan</th>
                      <th className="py-3 px-3.5 text-right">Amount</th>
                      <th className="py-3 px-3.5 text-right">Expected Profit</th>
                      <th className="py-3 px-3.5 text-right">Maturity Amount</th>
                      <th className="py-3 px-3.5">Start</th>
                      <th className="py-3 px-3.5">Maturity</th>
                      <th className="py-3 px-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className={tbodyClass}>
                    {finance.investments.map((inv) => (
                      <tr key={inv.id} className={trClass}>
                        <td className="py-3 px-3.5 font-mono font-semibold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                          {inv.reference}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">{inv.planName}</div>
                          <div className="text-[10px] text-slate-500">{inv.durationDays} days</div>
                        </td>
                        <td className={`py-3 px-3.5 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                          {formatINR(inv.amount)}
                        </td>
                        <td className={`py-3 px-3.5 font-bold text-emerald-600 dark:text-emerald-400 ${numCellClass}`}>
                          +{formatINR(inv.expectedProfit)}
                        </td>
                        <td className={`py-3 px-3.5 text-slate-800 dark:text-slate-200 ${numCellClass}`}>
                          {formatINR(inv.maturityAmount)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(inv.startDate)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(inv.maturityDate)}
                          {inv.status === 'ACTIVE' && (
                            <div className="text-[10px] text-slate-400">{inv.daysRemaining}d left</div>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <FinanceStatusBadge status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Recent Wallet Transactions ({finance.transactions.length})
              </h3>
              <Link
                to="/wallet-transactions"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                Wallet ledger
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            {finance.transactions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800/80">
                No wallet transactions recorded for this customer.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className={theadClass}>
                    <tr>
                      <th className="py-3 px-3.5">Reference</th>
                      <th className="py-3 px-3.5">Date</th>
                      <th className="py-3 px-3.5">Type</th>
                      <th className="py-3 px-3.5 text-right">Amount</th>
                      <th className="py-3 px-3.5 text-right">Balance After</th>
                      <th className="py-3 px-3.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className={tbodyClass}>
                    {finance.transactions.map((txn) => {
                      const isCredit = txn.direction === 'CREDIT';
                      return (
                        <tr key={txn.id} className={trClass}>
                          <td className="py-3 px-3.5 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {txn.reference}
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDateTime(txn.createdAt)}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {humanize(txn.type)}
                          </td>
                          <td
                            className={`py-3 px-3.5 font-bold ${numCellClass} ${
                              isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isCredit ? '+' : '-'}
                            {formatINR(txn.amount)}
                          </td>
                          <td className={`py-3 px-3.5 text-slate-800 dark:text-slate-200 ${numCellClass}`}>
                            {formatINR(txn.balanceAfter)}
                          </td>
                          <td
                            className="py-3 px-3.5 text-slate-600 dark:text-slate-300 max-w-[260px] truncate"
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
            )}
          </div>

          <WalletAdjustModal
            isOpen={isAdjustOpen}
            onClose={() => setIsAdjustOpen(false)}
            userId={customerId}
            customerName={customerName}
            walletBalance={Number(finance.walletBalance || 0)}
          />
        </>
      )}
    </div>
  );
};
