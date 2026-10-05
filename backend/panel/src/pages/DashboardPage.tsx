import React from 'react';
import { Link } from 'react-router-dom';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Users, Clock, CheckCircle2, XCircle, UserPlus, ArrowRight, ShieldCheck, AlertCircle, CreditCard } from 'lucide-react';
import { useDashboardStats } from '../hooks';
import { StatCard } from '../components/StatCard';
import { RegistrationChart, KycDistributionChart } from '../components/Charts';
import { InvestmentOverviewSection } from '../components/InvestmentOverviewSection';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { btnPrimaryClass, cardClass } from '../components/ui';
import { getApiErrorMessage } from '../utils/finance';

export const DashboardPage: React.FC = () => {
  const { data: stats, isLoading, isError, error, refetch } = useDashboardStats();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: ['finance-dashboard'] }) + useIsFetching({ queryKey: ['dashboard-stats'] }) > 0;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Payment and withdrawal queues, investment activity, customer growth and KYC compliance at a glance"
        actions={
          <>
            <RefreshButton onClick={handleRefresh} isFetching={isFetching} />
            <Link to="/payments" className={btnPrimaryClass}>
              <CreditCard className="w-3.5 h-3.5" />
              Review Payments
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </>
        }
      />

      {/* Primary: investment platform overview */}
      <InvestmentOverviewSection />

      {/* Secondary: customers & KYC compliance */}
      <section className="space-y-4" aria-labelledby="kyc-overview-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 id="kyc-overview-title" className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Customers & KYC
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Onboarding velocity and compliance status</p>
            </div>
          </div>

          <Link
            to="/kyc"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition"
          >
            <span>Open KYC Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4 animate-pulse" role="status" aria-label="Loading">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800/60 rounded-2xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-72 bg-slate-200 dark:bg-slate-800/60 rounded-2xl" />
              <div className="h-72 bg-slate-200 dark:bg-slate-800/60 rounded-2xl" />
            </div>
          </div>
        ) : isError || !stats ? (
          <div role="alert" className="p-6 text-center bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {getApiErrorMessage(error, 'Failed to load customer and KYC statistics')}
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total Customers"
                value={stats.totalCustomers}
                icon={Users}
                iconBgClass="bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"
              />
              <StatCard
                title="Registered Today"
                value={stats.newCustomersToday}
                icon={UserPlus}
                colorClass="text-indigo-600 dark:text-indigo-400"
                iconBgClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                subtitle="New accounts"
              />
              <Link to="/kyc" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <StatCard
                  title="Pending KYC"
                  value={stats.pendingKyc}
                  icon={Clock}
                  colorClass="text-amber-600 dark:text-amber-400"
                  iconBgClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  subtitle="Awaiting review"
                />
              </Link>
              <StatCard
                title="Verified KYC"
                value={stats.verifiedKyc}
                icon={CheckCircle2}
                colorClass="text-emerald-600 dark:text-emerald-400"
                iconBgClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                subtitle="Approved customers"
              />
              <StatCard
                title="Rejected KYC"
                value={stats.rejectedKyc}
                icon={XCircle}
                colorClass="text-rose-600 dark:text-rose-400"
                iconBgClass="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                subtitle="Declined applications"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`lg:col-span-2 ${cardClass}`}>
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Customer Registrations (Past 7 Days)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Daily customer onboarding</p>
                </div>
                <RegistrationChart data={stats.registrationTrend || []} />
              </div>

              <div className={`${cardClass} flex flex-col justify-between`}>
                <div className="flex items-center justify-between mb-4 gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      KYC Status Distribution
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Compliance state breakdown</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg whitespace-nowrap">
                    {Number(stats.verifiedKyc || 0).toLocaleString('en-IN')} Verified
                  </span>
                </div>
                <KycDistributionChart data={stats.kycStatusDistribution || []} />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
