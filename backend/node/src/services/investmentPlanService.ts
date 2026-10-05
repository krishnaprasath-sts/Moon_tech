import { InvestmentPlan, Investment } from '../models/index.js';
import { InvestmentStatus, ProfitType } from '../types/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise, formatInr } from '../utils/money.js';
import { toIso } from '../utils/dates.js';
import { RequestMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import {
  CreateInvestmentPlanInput,
  UpdateInvestmentPlanInput,
} from '../validators/financeValidators.js';

const MAX_PERCENTAGE = 1000;

export interface PlanTerms {
  profit_type: ProfitType;
  profit_value: number;
}

/**
 * Profit for a principal under the given plan terms, in paise.
 * PERCENTAGE is the total return over the whole investment period.
 */
export function calculateProfitPaise(terms: PlanTerms, amountPaise: number): number {
  if (terms.profit_type === ProfitType.FIXED) {
    return toPaise(terms.profit_value);
  }
  // profit_value has 2 decimals, so work in basis points to stay in integers
  const basisPoints = toPaise(terms.profit_value);
  return Math.round((amountPaise * basisPoints) / 10000);
}

export function serializePlan(plan: InvestmentPlan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    minAmount: plan.min_amount,
    maxAmount: plan.max_amount,
    durationDays: plan.duration_days,
    profitType: plan.profit_type,
    profitValue: plan.profit_value,
    isActive: Boolean(plan.is_active),
    isFeatured: Boolean(plan.is_featured),
    featuredTagline: plan.featured_tagline ?? null,
    sortOrder: plan.sort_order,
    createdAt: toIso(plan.created_at),
    updatedAt: toIso(plan.updated_at),
  };
}

export class InvestmentPlanService {
  private static assertValidTerms(terms: {
    minAmount: number;
    maxAmount: number;
    profitType: ProfitType;
    profitValue: number;
  }) {
    if (toPaise(terms.maxAmount) < toPaise(terms.minAmount)) {
      throw new BadRequestError('Maximum investment must be greater than or equal to the minimum investment');
    }
    if (terms.profitType === ProfitType.PERCENTAGE && terms.profitValue > MAX_PERCENTAGE) {
      throw new BadRequestError(`Profit percentage cannot exceed ${MAX_PERCENTAGE}%`);
    }
  }

  /**
   * Public / Customer: plans currently open for investment
   */
  public static async listActivePlans() {
    const plans = await InvestmentPlan.findAll({
      where: { is_active: true },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return plans.map(serializePlan);
  }

  /**
   * Public / Customer: plans the admin chose to feature, in display order
   */
  public static async listFeaturedPlans() {
    const plans = await InvestmentPlan.findAll({
      where: { is_active: true, is_featured: true },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return plans.map(serializePlan);
  }

  /**
   * Admin: all plans with investment aggregates
   */
  public static async adminListPlans() {
    const plans = await InvestmentPlan.findAll({
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
      include: [{ model: Investment, as: 'investments', attributes: ['id', 'amount', 'status'] }],
    });

    return plans.map((plan) => {
      const investments: Investment[] = (plan as any).investments || [];
      const counted = investments.filter((i) => i.status !== InvestmentStatus.CANCELLED);
      return {
        ...serializePlan(plan),
        totalInvestments: counted.length,
        activeInvestments: investments.filter((i) => i.status === InvestmentStatus.ACTIVE).length,
        totalInvested: fromPaise(counted.reduce((acc, i) => acc + toPaise(i.amount), 0)),
      };
    });
  }

  public static async createPlan(input: CreateInvestmentPlanInput, adminId: number, meta: RequestMeta = {}) {
    this.assertValidTerms(input);

    const plan = await InvestmentPlan.create({
      name: input.name,
      description: input.description?.trim() || null,
      min_amount: input.minAmount,
      max_amount: input.maxAmount,
      duration_days: input.durationDays,
      profit_type: input.profitType,
      profit_value: input.profitValue,
      is_active: input.isActive ?? true,
      is_featured: input.isFeatured ?? false,
      featured_tagline: input.featuredTagline?.trim() || null,
      sort_order: input.sortOrder ?? 0,
    });

    await ActivityLogService.log({
      userId: adminId,
      action: 'INVESTMENT_PLAN_CREATED',
      entity: 'INVESTMENT_PLAN',
      entityId: plan.id,
      description: `Admin #${adminId} created investment plan "${plan.name}" (${formatInr(plan.min_amount)} - ${formatInr(
        plan.max_amount
      )}, ${plan.duration_days} days, ${
        plan.profit_type === ProfitType.PERCENTAGE ? `${plan.profit_value}%` : `${formatInr(plan.profit_value)} fixed`
      })`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return serializePlan(plan);
  }

  /**
   * Edits apply to new investments only; running investments keep their snapshotted terms
   */
  public static async updatePlan(
    planId: number,
    input: UpdateInvestmentPlanInput,
    adminId: number,
    meta: RequestMeta = {}
  ) {
    const plan = await InvestmentPlan.findByPk(planId);
    if (!plan) {
      throw new NotFoundError('Investment plan not found');
    }

    this.assertValidTerms({
      minAmount: input.minAmount ?? plan.min_amount,
      maxAmount: input.maxAmount ?? plan.max_amount,
      profitType: input.profitType ?? plan.profit_type,
      profitValue: input.profitValue ?? plan.profit_value,
    });

    if (input.name !== undefined) plan.name = input.name;
    if (input.description !== undefined) plan.description = input.description?.trim() || null;
    if (input.minAmount !== undefined) plan.min_amount = input.minAmount;
    if (input.maxAmount !== undefined) plan.max_amount = input.maxAmount;
    if (input.durationDays !== undefined) plan.duration_days = input.durationDays;
    if (input.profitType !== undefined) plan.profit_type = input.profitType;
    if (input.profitValue !== undefined) plan.profit_value = input.profitValue;
    if (input.isActive !== undefined) plan.is_active = input.isActive;
    if (input.isFeatured !== undefined) plan.is_featured = input.isFeatured;
    if (input.featuredTagline !== undefined) plan.featured_tagline = input.featuredTagline?.trim() || null;
    if (input.sortOrder !== undefined) plan.sort_order = input.sortOrder;

    await plan.save();

    await ActivityLogService.log({
      userId: adminId,
      action: 'INVESTMENT_PLAN_UPDATED',
      entity: 'INVESTMENT_PLAN',
      entityId: plan.id,
      description: `Admin #${adminId} updated investment plan #${plan.id} "${plan.name}"`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return serializePlan(plan);
  }

  public static async setPlanStatus(planId: number, isActive: boolean, adminId: number, meta: RequestMeta = {}) {
    const plan = await InvestmentPlan.findByPk(planId);
    if (!plan) {
      throw new NotFoundError('Investment plan not found');
    }

    plan.is_active = isActive;
    await plan.save();

    await ActivityLogService.log({
      userId: adminId,
      action: 'INVESTMENT_PLAN_STATUS_CHANGED',
      entity: 'INVESTMENT_PLAN',
      entityId: plan.id,
      description: `Admin #${adminId} ${isActive ? 'activated' : 'deactivated'} investment plan #${plan.id} "${plan.name}"`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return serializePlan(plan);
  }

  /**
   * Admin: feature / unfeature a plan on the website, optionally with a tagline
   */
  public static async setPlanFeatured(
    planId: number,
    isFeatured: boolean,
    featuredTagline: string | null | undefined,
    adminId: number,
    meta: RequestMeta = {}
  ) {
    const plan = await InvestmentPlan.findByPk(planId);
    if (!plan) {
      throw new NotFoundError('Investment plan not found');
    }

    plan.is_featured = isFeatured;
    if (featuredTagline !== undefined) plan.featured_tagline = featuredTagline?.trim() || null;
    await plan.save();

    await ActivityLogService.log({
      userId: adminId,
      action: isFeatured ? 'INVESTMENT_PLAN_FEATURED' : 'INVESTMENT_PLAN_UNFEATURED',
      entity: 'INVESTMENT_PLAN',
      entityId: plan.id,
      description: `Admin #${adminId} ${isFeatured ? 'featured' : 'removed from featured'} investment plan #${plan.id} "${plan.name}"`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return serializePlan(plan);
  }

  /**
   * Plans that have ever been invested in are kept for the audit trail
   */
  public static async deletePlan(planId: number, adminId: number, meta: RequestMeta = {}) {
    const plan = await InvestmentPlan.findByPk(planId);
    if (!plan) {
      throw new NotFoundError('Investment plan not found');
    }

    const investmentCount = await Investment.count({ where: { plan_id: planId } });
    if (investmentCount > 0) {
      throw new BadRequestError(
        `Plan "${plan.name}" has ${investmentCount} investment(s) and cannot be deleted. Deactivate it instead.`
      );
    }

    const planName = plan.name;
    await plan.destroy();

    await ActivityLogService.log({
      userId: adminId,
      action: 'INVESTMENT_PLAN_DELETED',
      entity: 'INVESTMENT_PLAN',
      entityId: planId,
      description: `Admin #${adminId} deleted investment plan "${planName}"`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { id: planId, message: `Plan "${planName}" deleted successfully` };
  }
}
