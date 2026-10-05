import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  Wallet,
  BadgeCheck,
  CreditCard,
  Banknote,
  IndianRupee,
  ArrowLeftRight,
  ArrowRight,
  AlertCircle,
  CalendarClock,
} from 'lucide-react';
import { useFinanceDashboard } from '../hooks/useFinance';
import { StatCard } from './StatCard';
import { formatINR, formatDate, formatDateTime, formatNumber, getApiErrorMessage, humanize } from '../utils/finance';

const panelClass =
  'bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-lg flex flex-col transition-colors duration-200';

// Primary dashboard content: wallet payments, investments, maturities and withdrawal payouts
export const InvestmentOverviewSection: React.FC = () => {
  const { data: finance, isLoading, isError, error, refetch } = useFinanceDashboard();

  return (
    <section className="space-y-4" aria-labelledby="investment-overview-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 id="investment-overview-title" className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Investment Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Wallet payments, investments, maturities and withdrawal payouts
            </p>
          </div>
        </div>

        <Link
          to="/investments"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition"
        >
          <span>Open Investments</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse" role="status" aria-label="Loading">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800/60 rounded-2xl" />
          ))}
        </div>
      ) : isError || !finance ? (
        <div role="alert" className="p-6 text-center bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {getApiErrorMessage(error, 'Failed to load the investment overview')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Action queues first: these need attention today */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/payments" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <StatCard
                title="Pending Payments"
                value={finance.pendingPaymentVerifications}
                icon={CreditCard}
                colorClass="text-amber-600 dark:text-amber-400"
                iconBgClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                subtitle={`${formatINR(finance.pendingPaymentAmount)} to verify`}
              />
            </Link>

            <Link to="/withdrawals" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <StatCard
                title="Pending Withdrawals"
                value={finance.pendingWithdrawalRequests}
                icon={Banknote}
                colorClass="text-rose-600 dark:text-rose-400"
                iconBgClass="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                subtitle={`${formatINR(finance.pendingWithdrawalAmount)} requested`}
              />
            </Link>

            <StatCard
              title="Active Investments"
              value={finance.activeInvestments}
              icon={TrendingUp}
              colorClass="text-emerald-600 dark:text-emerald-400"
              iconBgClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              subtitle={`${formatINR(finance.activeInvestmentAmount)} invested`}
            />

            <StatCard
              title="Matured Investments"
              value={finance.totalMaturedInvestments}
              icon={BadgeCheck}
              colorClass="text-violet-600 dark:text-violet-400"
              iconBgClass="bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
              subtitle={`${formatNumber(finance.maturedAwaitingWithdrawal)} awaiting withdrawal (${formatINR(
                finance.maturedAwaitingAmount
              )})`}
            />

            <StatCard
              title="Total Invested"
              value={formatINR(finance.totalInvestmentAmount)}
              icon={Wallet}
              colorClass="text-indigo-600 dark:text-indigo-400"
              iconBgClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
              subtitle={`${formatNumber(finance.totalInvestments)} investments • ${formatINR(finance.totalDeposited)} deposited`}
            />

            <StatCard
              title="Total Profit Paid"
              value={formatINR(finance.totalProfitPaid)}
              icon={IndianRupee}
              colorClass="text-emerald-600 dark:text-emerald-400"
              iconBgClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              subtitle={`${formatINR(finance.totalWithdrawn)} withdrawn in total`}
            />

            <StatCard
              title="Wallet Balances"
              value={formatINR(finance.totalWalletBalance)}
              icon={ArrowLeftRight}
              colorClass="text-sky-600 dark:text-sky-400"
              iconBgClass="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
              subtitle={`${formatNumber(finance.walletTransactions)} ledger entries`}
            />

            <StatCard
              title="Customers"
              value={finance.totalUsers}
              icon={Users}
              iconBgClass="bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"
              subtitle={`${formatNumber(finance.activeUsers)} active`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming maturities */}
            <div className={panelClass}>
              <div className="flex items-center justify-between mb-4 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Upcoming Maturities
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Active investments maturing next</p>
                </div>
                <Link
                  to="/investments"
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 flex items-center gap-1 whitespace-nowrap"
                >
                  View All
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {(finance.upcomingMaturities || []).length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No active investments are due to mature soon.</div>
              ) : (
                <div className="space-y-2.5">
                  {finance.upcomingMaturities.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.customerName || item.customerEmail || 'Customer'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.planName} • <span className="font-mono">{item.reference}</span>
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                          {formatINR(item.maturityAmount)}
                        </p>
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {formatDate(item.maturityDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent wallet transactions */}
            <div className={panelClass}>
              <div className="flex items-center justify-between mb-4 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Recent Wallet Transactions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Latest credits and debits</p>
                </div>
                <Link
                  to="/wallet-transactions"
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 flex items-center gap-1 whitespace-nowrap"
                >
                  Wallet Ledger
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {(finance.recentTransactions || []).length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No wallet transactions recorded yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {finance.recentTransactions.map((txn) => {
                    const isCredit = txn.direction === 'CREDIT';
                    return (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {txn.customerName || txn.customerEmail || `Customer #${txn.userId}`}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {humanize(txn.type)} • {formatDateTime(txn.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-bold font-mono tabular-nums flex-shrink-0 ${
                            isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatINR(txn.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
