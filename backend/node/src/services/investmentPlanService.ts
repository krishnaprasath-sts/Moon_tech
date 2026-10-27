import { InvestmentPlan, Investment } from '../models/index.js';
import { InvestmentStatus, ProfitType, ProfitPayoutMode, RateBasis } from '../types/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise, formatInr } from '../utils/money.js';
import { toIso } from '../utils/dates.js';
import {
  WORKING_DAYS_PER_MONTH,
  WORKING_DAYS_PER_WEEK,
  istDayKey,
  maxCreditsForTerm,
  monthlyCreditsForTerm,
  payableWorkingDays,
} from '../utils/workingDays.js';
import { RequestMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import {
  CreateInvestmentPlanInput,
  UpdateInvestmentPlanInput,
} from '../validators/financeValidators.js';

const MAX_PERCENTAGE = 1000;
const MAX_DAILY_PERCENTAGE = 100;

export interface PlanTerms {
  profit_type: ProfitType;
  profit_value: number;
  payout_mode?: ProfitPayoutMode;
  rate_basis?: RateBasis;
  /** Term in days (0 = open-ended); needed for the whole-months credit cap of monthly plans */
  duration_days?: number;
}

/**
 * Percentage of a principal in paise. The percentage is taken to 4 decimal places so that a
 * small rate like the daily referral commission (0.025%) is applied exactly: 10,000 at 0.025%
 * is 2.50, not 3.00. Plan rates and fees have 2 decimals and are unaffected.
 */
export function percentOfPaise(amountPaise: number, percent: number): number {
  const num = Number(percent);
  if (!Number.isFinite(num) || !Number.isFinite(amountPaise)) return 0;
  const tenThousandths = Math.round(num * 10000); // 0.025% -> 250
  return Math.round((amountPaise * tenThousandths) / 1000000);
}

/**
 * Profit credited on each working day of a DAILY plan, in paise.
 * PER_MONTH: monthly profit / 20 (e.g. 1,00,000 at 5% -> 5,000 a month -> 250 a day).
 * PER_YEAR:  yearly profit / 240.
 * PER_DAY:   legacy, the percentage itself every working day.
 */
export function dailyProfitPaise(terms: PlanTerms, amountPaise: number): number {
  const percentPaise = percentOfPaise(amountPaise, terms.profit_value);
  switch (terms.rate_basis ?? RateBasis.PER_DAY) {
    case RateBasis.PER_MONTH:
      return Math.round(percentPaise / WORKING_DAYS_PER_MONTH);
    case RateBasis.PER_YEAR:
      return Math.round(percentPaise / (12 * WORKING_DAYS_PER_MONTH));
    default:
      return percentPaise;
  }
}

/**
 * The per-working-day percentage of the capital, derived from the plan rate:
 * PER_MONTH 5% -> 0.25% a day, 6% -> 0.30% a day; PER_YEAR 6% -> 0.025%; PER_DAY unchanged.
 */
export function dailyRatePercent(terms: PlanTerms): number {
  const rate = Number(terms.profit_value) || 0;
  switch (terms.rate_basis ?? RateBasis.PER_DAY) {
    case RateBasis.PER_MONTH:
      return Math.round((rate / WORKING_DAYS_PER_MONTH) * 10000) / 10000;
    case RateBasis.PER_YEAR:
      return Math.round((rate / (12 * WORKING_DAYS_PER_MONTH)) * 10000) / 10000;
    default:
      return rate;
  }
}

export function weeklyProfitPaise(terms: PlanTerms, amountPaise: number): number {
  return dailyProfitPaise(terms, amountPaise) * WORKING_DAYS_PER_WEEK;
}

export function monthlyProfitPaise(terms: PlanTerms, amountPaise: number): number {
  return dailyProfitPaise(terms, amountPaise) * WORKING_DAYS_PER_MONTH;
}

/** Max credits per 30-day cycle; legacy per-day plans pay every working day */
export function perCycleCap(terms: PlanTerms): number | undefined {
  return (terms.rate_basis ?? RateBasis.PER_DAY) === RateBasis.PER_DAY ? undefined : WORKING_DAYS_PER_MONTH;
}

/**
 * Total credits a fixed-term monthly plan pays (365 days -> 12 months -> 240 credits).
 * undefined = no total cap (open-ended, or legacy per-day plans).
 */
export function termCreditCap(terms: PlanTerms): number | undefined {
  if (perCycleCap(terms) === undefined) return undefined;
  return maxCreditsForTerm(Number(terms.duration_days) || 0);
}

/**
 * IST day keys on which a DAILY investment earns profit between its start and `toDate`:
 * working days (Mon-Fri) after the start day, capped per 30-day cycle for monthly plans and,
 * for fixed terms, at whole months in total.
 */
export function payingDaysForTerm(terms: PlanTerms, startDate: Date, toDate: Date): string[] {
  return payableWorkingDays(istDayKey(startDate), istDayKey(toDate), perCycleCap(terms), termCreditCap(terms));
}

export function profitDaysForTerm(terms: PlanTerms, startDate: Date, maturityDate: Date): number {
  return payingDaysForTerm(terms, startDate, maturityDate).length;
}

/**
 * Total profit for a principal under the given plan terms, in paise.
 * AT_MATURITY + PERCENTAGE: total return over the whole period.
 * AT_MATURITY + FIXED: flat rupee amount.
 * DAILY with a maturity: daily credit x number of paying days in the term.
 * DAILY open-ended (no maturity): 0, there is no fixed total; see monthlyProfitPaise.
 */
export function calculateProfitPaise(
  terms: PlanTerms,
  amountPaise: number,
  term?: { startDate: Date; maturityDate: Date | null }
): number {
  if (terms.payout_mode === ProfitPayoutMode.DAILY) {
    if (!term) throw new Error('Daily-profit plans need the investment term to calculate the total profit');
    if (!term.maturityDate) return 0;
    return dailyProfitPaise(terms, amountPaise) * profitDaysForTerm(terms, term.startDate, term.maturityDate);
  }
  if (terms.payout_mode === ProfitPayoutMode.MONTHLY) {
    // One credit per whole 30-day month of the term (365 days = 12), paid on the start date anniversary
    return percentOfPaise(amountPaise, terms.profit_value) * monthlyCreditsForTerm(Number(terms.duration_days) || 0);
  }
  if (terms.profit_type === ProfitType.FIXED) {
    return toPaise(terms.profit_value);
  }
  return percentOfPaise(amountPaise, terms.profit_value);
}

export function serializePlan(plan: InvestmentPlan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    minAmount: plan.min_amount,
    maxAmount: plan.max_amount,
    durationDays: plan.duration_days,
    isOpenEnded: plan.duration_days === 0,
    lockInDays: plan.lock_in_days,
    profitType: plan.profit_type,
    profitValue: plan.profit_value,
    payoutMode: plan.payout_mode,
    rateBasis: plan.rate_basis,
    // 5% / month -> 0.25% per working day
    dailyRatePercent: plan.payout_mode === ProfitPayoutMode.DAILY ? dailyRatePercent(plan) : 0,
    isMonthly: plan.payout_mode === ProfitPayoutMode.MONTHLY,
    monthlyRatePercent: plan.payout_mode === ProfitPayoutMode.MONTHLY ? Number(plan.profit_value) : 0,
    creditsPerMonth: WORKING_DAYS_PER_MONTH,
    creditsPerWeek: WORKING_DAYS_PER_WEEK,
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
    durationDays: number;
    lockInDays: number;
    profitType: ProfitType;
    profitValue: number;
    payoutMode: ProfitPayoutMode;
  }) {
    if (toPaise(terms.maxAmount) < toPaise(terms.minAmount)) {
      throw new BadRequestError('Maximum investment must be greater than or equal to the minimum investment');
    }
    if (terms.durationDays === 0 && terms.payoutMode !== ProfitPayoutMode.DAILY) {
      throw new BadRequestError('Only daily-profit plans can be open-ended (0 days). Set a period for other plans.');
    }
    if (terms.durationDays > 0 && terms.lockInDays > terms.durationDays) {
      throw new BadRequestError('The lock-in period cannot be longer than the investment period');
    }
    if (terms.payoutMode === ProfitPayoutMode.DAILY) {
      if (terms.profitType !== ProfitType.PERCENTAGE) {
        throw new BadRequestError('Daily-profit plans must use a percentage profit (% of the capital)');
      }
      if (terms.profitValue > MAX_DAILY_PERCENTAGE) {
        throw new BadRequestError(`Profit percentage cannot exceed ${MAX_DAILY_PERCENTAGE}%`);
      }
      return;
    }
    if (terms.payoutMode === ProfitPayoutMode.MONTHLY) {
      if (terms.profitType !== ProfitType.PERCENTAGE) {
        throw new BadRequestError('Monthly-payout plans must use a percentage profit (% of the capital)');
      }
      if (terms.profitValue > MAX_PERCENTAGE) {
        throw new BadRequestError(`Profit percentage cannot exceed ${MAX_PERCENTAGE}%`);
      }
      return;
    }
    if (terms.profitType === ProfitType.PERCENTAGE && terms.profitValue > MAX_PERCENTAGE) {
      throw new BadRequestError(`Profit percentage cannot exceed ${MAX_PERCENTAGE}%`);
    }
  }

  private static describeRate(plan: InvestmentPlan): string {
    if (plan.payout_mode === ProfitPayoutMode.MONTHLY) {
      return `${plan.profit_value}% per month, credited once a month on start date`;
    }
    if (plan.payout_mode !== ProfitPayoutMode.DAILY) {
      return plan.profit_type === ProfitType.PERCENTAGE ? `${plan.profit_value}%` : `${formatInr(plan.profit_value)} fixed`;
    }
    const basis =
      plan.rate_basis === RateBasis.PER_MONTH ? 'per month' : plan.rate_basis === RateBasis.PER_YEAR ? 'per year' : 'per working day';
    return `${plan.profit_value}% ${basis}, credited every working day`;
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
    const payoutMode = input.payoutMode ?? ProfitPayoutMode.AT_MATURITY;
    // Capital can be withdrawn at any time; lock-ins are no longer used
    const lockInDays = 0;
    this.assertValidTerms({ ...input, payoutMode, lockInDays });

    const plan = await InvestmentPlan.create({
      name: input.name,
      description: input.description?.trim() || null,
      min_amount: input.minAmount,
      max_amount: input.maxAmount,
      duration_days: input.durationDays,
      profit_type: input.profitType,
      profit_value: input.profitValue,
      payout_mode: payoutMode,
      rate_basis: input.rateBasis ?? RateBasis.PER_MONTH,
      lock_in_days: lockInDays,
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
      )}, ${plan.duration_days === 0 ? 'open-ended' : `${plan.duration_days} days`}, lock-in ${plan.lock_in_days} days, ${this.describeRate(
        plan
      )})`,
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
      durationDays: input.durationDays ?? plan.duration_days,
      lockInDays: 0,
      profitType: input.profitType ?? plan.profit_type,
      profitValue: input.profitValue ?? plan.profit_value,
      payoutMode: input.payoutMode ?? plan.payout_mode,
    });

    if (input.name !== undefined) plan.name = input.name;
    if (input.description !== undefined) plan.description = input.description?.trim() || null;
    if (input.minAmount !== undefined) plan.min_amount = input.minAmount;
    if (input.maxAmount !== undefined) plan.max_amount = input.maxAmount;
    if (input.durationDays !== undefined) plan.duration_days = input.durationDays;
    plan.lock_in_days = 0; // capital can be withdrawn at any time
    if (input.profitType !== undefined) plan.profit_type = input.profitType;
    if (input.profitValue !== undefined) plan.profit_value = input.profitValue;
    if (input.payoutMode !== undefined) plan.payout_mode = input.payoutMode;
    if (input.rateBasis !== undefined) plan.rate_basis = input.rateBasis;
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
