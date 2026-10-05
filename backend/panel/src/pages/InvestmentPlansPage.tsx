import React, { useState } from 'react';
import { Plus, Edit2, Trash2, PiggyBank, CheckCircle2, Layers, TrendingUp, Star } from 'lucide-react';
import {
  useInvestmentPlans,
  useToggleInvestmentPlanStatus,
  useSetInvestmentPlanFeatured,
  useDeleteInvestmentPlan,
} from '../hooks';
import { StatCard } from '../components/StatCard';
import { TableStateRow } from '../components/TableStateRow';
import { InvestmentPlanModal } from '../components/InvestmentPlanModal';
import { ActionModal } from '../components/ActionModal';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { Switch } from '../components/Switch';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { InvestmentPlan } from '../types';
import { btnPrimaryClass, tableCardClass, theadClass, tbodyClass, trClass, numCellClass } from '../components/ui';
import { formatINR, formatNumber, getApiErrorMessage } from '../utils/finance';

const formatProfit = (plan: InvestmentPlan) =>
  plan.profitType === 'PERCENTAGE' ? `${plan.profitValue}%` : `${formatINR(plan.profitValue)} fixed`;

export const InvestmentPlansPage: React.FC = () => {
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<InvestmentPlan | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<InvestmentPlan | null>(null);

  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const { data: plans = [], isLoading, isError, error, refetch, isFetching } = useInvestmentPlans();
  const { mutateAsync: togglePlanStatus, isPending: isToggling, variables: togglingVars } =
    useToggleInvestmentPlanStatus();
  const { mutateAsync: setPlanFeatured, isPending: isFeaturing, variables: featuringVars } =
    useSetInvestmentPlanFeatured();
  const { mutateAsync: deletePlan, isPending: isDeleting } = useDeleteInvestmentPlan();

  const totalInvested = plans.reduce((sum, p) => sum + (Number(p.totalInvested) || 0), 0);
  const activeInvestments = plans.reduce((sum, p) => sum + (Number(p.activeInvestments) || 0), 0);

  const openCreate = () => {
    setSelectedPlanForEdit(null);
    setIsPlanModalOpen(true);
  };

  const handleToggleStatus = async (plan: InvestmentPlan, isActive: boolean) => {
    if (isToggling) return;
    try {
      await togglePlanStatus({ id: plan.id, isActive });
      toast.success(
        isActive
          ? `"${plan.name}" is now active and offered to customers`
          : `"${plan.name}" is now inactive and hidden from customers`
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update the plan status'));
    }
  };

  const handleToggleFeatured = async (plan: InvestmentPlan, isFeatured: boolean) => {
    if (isFeaturing) return;
    try {
      await setPlanFeatured({ id: plan.id, isFeatured });
      toast.success(
        isFeatured
          ? `"${plan.name}" is now shown on the website's Featured Plans page`
          : `"${plan.name}" was removed from the Featured Plans page`
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update the featured flag'));
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      await deletePlan(planToDelete.id);
      toast.success(`Plan "${planToDelete.name}" has been deleted`, 'Plan deleted');
      setPlanToDelete(null);
    } catch (err) {
      // The API answers 400 when the plan already has investments
      toast.error(getApiErrorMessage(err, 'Failed to delete the plan'));
    }
  };

  const colSpan = isAdmin ? 8 : 7;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investment Plans"
        description="Create and manage the plans customers can invest in: limits, period and profit."
        viewOnly={!isAdmin}
        actions={
          <>
            <RefreshButton onClick={() => refetch()} isFetching={isFetching} />
            {isAdmin && (
              <button type="button" onClick={openCreate} className={btnPrimaryClass}>
                <Plus className="w-3.5 h-3.5" />
                Create Plan
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Plans"
          value={plans.length}
          icon={PiggyBank}
          iconBgClass="bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"
          subtitle="Active and inactive"
        />
        <StatCard
          title="Active Plans"
          value={plans.filter((p) => p.isActive).length}
          icon={CheckCircle2}
          colorClass="text-emerald-600 dark:text-emerald-400"
          iconBgClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          subtitle="Offered to customers"
        />
        <StatCard
          title="Active Investments"
          value={activeInvestments}
          icon={Layers}
          colorClass="text-indigo-600 dark:text-indigo-400"
          iconBgClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
          subtitle="Across all plans"
        />
        <StatCard
          title="Total Invested"
          value={formatINR(totalInvested)}
          icon={TrendingUp}
          colorClass="text-violet-600 dark:text-violet-400"
          iconBgClass="bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
          subtitle="Lifetime principal"
        />
      </div>

      <div className={tableCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theadClass}>
              <tr>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4 text-right">Min / Max Amount</th>
                <th className="py-3.5 px-4 text-right">Period</th>
                <th className="py-3.5 px-4">Profit</th>
                <th className="py-3.5 px-4 text-right">Investments</th>
                <th className="py-3.5 px-4 text-right">Total Invested</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Featured</th>
                {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              <TableStateRow
                colSpan={colSpan}
                isLoading={isLoading}
                isError={isError}
                isEmpty={plans.length === 0}
                loadingText="Loading investment plans..."
                emptyIcon={PiggyBank}
                emptyTitle="No investment plans yet"
                emptyText={
                  isAdmin
                    ? 'Customers cannot invest until at least one active plan exists. Create the first plan to get started.'
                    : 'No investment plans have been configured yet.'
                }
                emptyAction={
                  isAdmin ? (
                    <button type="button" onClick={openCreate} className={btnPrimaryClass}>
                      <Plus className="w-3.5 h-3.5" />
                      Create Plan
                    </button>
                  ) : undefined
                }
                errorText={getApiErrorMessage(error, 'Failed to load investment plans.')}
                onRetry={() => refetch()}
              />

              {!isLoading &&
                !isError &&
                plans.map((plan) => {
                  const isTogglingThis = isToggling && togglingVars?.id === plan.id;
                  const isFeaturingThis = isFeaturing && featuringVars?.id === plan.id;
                  return (
                    <tr key={plan.id} className={trClass}>
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <div className="font-bold text-slate-900 dark:text-white">{plan.name}</div>
                        {plan.description && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={plan.description}>
                            {plan.description}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono">
                          #{plan.id} • Order {plan.sortOrder ?? 0}
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 ${numCellClass}`}>
                        <div className="font-bold text-slate-900 dark:text-white">{formatINR(plan.minAmount)}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">to {formatINR(plan.maxAmount)}</div>
                      </td>
                      <td className={`py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300 ${numCellClass}`}>
                        {formatNumber(plan.durationDays)} days
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap font-mono">
                          {formatProfit(plan)}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 ${numCellClass}`}>
                        <span className="font-bold text-slate-900 dark:text-white">{formatNumber(plan.activeInvestments || 0)}</span>{' '}
                        <span className="text-slate-400 text-[11px] font-sans">active</span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                          {formatNumber(plan.totalInvestments || 0)} total
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                        {formatINR(plan.totalInvested || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={plan.isActive}
                            onChange={(next) => handleToggleStatus(plan, next)}
                            label={`${plan.name} is ${plan.isActive ? 'active' : 'inactive'}`}
                            disabled={!isAdmin}
                            busy={isTogglingThis}
                            title={isAdmin ? (plan.isActive ? 'Deactivate plan' : 'Activate plan') : undefined}
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              plan.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {plan.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={plan.isFeatured}
                            onChange={(next) => handleToggleFeatured(plan, next)}
                            label={`${plan.name} is ${plan.isFeatured ? 'featured' : 'not featured'} on the website`}
                            disabled={!isAdmin}
                            busy={isFeaturingThis}
                            title={isAdmin ? (plan.isFeatured ? 'Remove from Featured Plans page' : 'Show on Featured Plans page') : undefined}
                          />
                          {plan.isFeatured ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400"
                              title={plan.featuredTagline || undefined}
                            >
                              <Star className="w-3 h-3" />
                              Featured{!plan.isActive ? ' (hidden: inactive)' : ''}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">No</span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlanForEdit(plan);
                                setIsPlanModalOpen(true);
                              }}
                              aria-label={`Edit ${plan.name}`}
                              title="Edit plan"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPlanToDelete(plan)}
                              aria-label={`Delete ${plan.name}`}
                              title="Delete plan"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <InvestmentPlanModal
        plan={selectedPlanForEdit}
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false);
          setSelectedPlanForEdit(null);
        }}
      />

      <ActionModal
        isOpen={!!planToDelete}
        onClose={() => setPlanToDelete(null)}
        onSubmit={handleDeletePlan}
        tone="danger"
        title="Delete Investment Plan"
        subtitle="This cannot be undone"
        showInput={false}
        description={
          planToDelete && (
            <>
              Permanently delete <strong className="text-slate-900 dark:text-white">{planToDelete.name}</strong>? Plans
              that already have investments cannot be deleted - deactivate them instead so existing investments keep
              running.
            </>
          )
        }
        confirmText="Delete Plan"
        isLoading={isDeleting}
      />
    </div>
  );
};
