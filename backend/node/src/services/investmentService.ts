import { Op } from 'sequelize';
import {
  sequelize,
  Investment,
  InvestmentPlan,
  Withdrawal,
  User,
  CustomerProfile,
  KycProfile,
  Referral,
  ReferralCommission,
  ProfitCredit,
} from '../models/index.js';
import {
  InvestmentStatus,
  WalletTxnType,
  WalletTxnDirection,
  WalletBucket,
  NotificationType,
  UserRole,
  UserStatus,
  KycStatus,
  ProfitPayoutMode,
  RateBasis,
  ReferralCommissionStatus,
} from '../types/index.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise, formatInr, generateReference } from '../utils/money.js';
import { toIso, parseDbDate, addDays, parseDateRange } from '../utils/dates.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { SettingsService } from './settingsService.js';
import { WalletService, BUCKET_LABELS } from './walletService.js';
import { DailyPayoutService } from './dailyPayoutService.js';
import {
  calculateProfitPaise,
  dailyProfitPaise,
  dailyRatePercent,
  weeklyProfitPaise,
  monthlyProfitPaise,
  payingDaysForTerm,
  perCycleCap,
  percentOfPaise,
  profitDaysForTerm,
} from './investmentPlanService.js';
import { InvestInput } from '../validators/financeValidators.js';
import {
  PAYOUT_HOUR_IST,
  WORKING_DAYS_PER_MONTH,
  cycleNoForDay,
  istDayKey,
  istTimeOnDay,
  latestPayableDay,
  monthlyCreditsForTerm,
  monthlyDueDates,
} from '../utils/workingDays.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead paying days are listed for open-ended investments (next credit, cycle progress) */
const OPEN_ENDED_HORIZON_DAYS = 45;

/** Fee charged when the capital of an investment is withdrawn, in paise */
export function capitalFeePaise(amountPaise: number, feePercent: number): number {
  return percentOfPaise(amountPaise, feePercent);
}

/**
 * Money breakdown of a capital withdrawal. The fee is charged on the capital only; profit paid
 * along with it (maturity-paid plans, profit granted by the admin on an early exit) is fee-free.
 */
export function capitalWithdrawalBreakdown(principalPaise: number, profitPaise: number, feePercent: number) {
  const feePaise = capitalFeePaise(principalPaise, feePercent);
  const grossPaise = principalPaise + profitPaise;
  return { principalPaise, profitPaise, grossPaise, feePaise, netPaise: grossPaise - feePaise };
}

/**
 * Whether the capital of an investment can be withdrawn right now. Lock-ins are no longer used
 * (every investment is created with lock_in_days 0), so this only still honours legacy rows.
 */
export function lockState(inv: Investment, now = Date.now()) {
  const start = parseDbDate(inv.start_date);
  const lockInDays = Number(inv.lock_in_days) || 0;
  const lockInEndsAt = start && lockInDays > 0 ? addDays(start, lockInDays) : null;
  const isLocked =
    lockInEndsAt !== null && lockInEndsAt.getTime() > now && !inv.early_withdrawal_allowed;
  return { lockInDays, lockInEndsAt, isLocked };
}

export interface InvestmentFilterParams {
  page?: unknown;
  limit?: unknown;
  status?: string;
  search?: string;
  planId?: unknown;
  userId?: unknown;
  maturingInDays?: unknown;
  startDate?: string;
  endDate?: string;
}

export function serializeInvestment(inv: Investment) {
  const start = parseDbDate(inv.start_date);
  const maturity = parseDbDate(inv.maturity_date);
  const now = Date.now();
  const isOpenEnded = !maturity;

  let progressPercent = 100;
  let daysRemaining = 0;
  if (start && maturity && inv.status === InvestmentStatus.ACTIVE) {
    const total = maturity.getTime() - start.getTime();
    const elapsed = Math.max(0, Math.min(now - start.getTime(), total));
    progressPercent = total > 0 ? Math.round((elapsed / total) * 1000) / 10 : 100;
    daysRemaining = Math.max(0, Math.ceil((maturity.getTime() - now) / DAY_MS));
  } else if (isOpenEnded && inv.status === InvestmentStatus.ACTIVE) {
    progressPercent = 0;
  }

  const { lockInDays, lockInEndsAt, isLocked } = lockState(inv, now);
  const canRequestWithdrawal =
    (inv.status === InvestmentStatus.ACTIVE || inv.status === InvestmentStatus.MATURED) && !isLocked;

  const isDaily = inv.payout_mode === ProfitPayoutMode.DAILY;
  const isMonthly = inv.payout_mode === ProfitPayoutMode.MONTHLY;
  const amountPaise = toPaise(inv.amount);
  const perDayPaise = isDaily ? dailyProfitPaise(inv, amountPaise) : 0;
  const dailyProfit = fromPaise(perDayPaise);
  const weeklyProfit = isDaily ? fromPaise(weeklyProfitPaise(inv, amountPaise)) : 0;
  const monthlyProfit = isMonthly
    ? fromPaise(percentOfPaise(amountPaise, inv.profit_value))
    : isDaily
    ? fromPaise(monthlyProfitPaise(inv, amountPaise))
    : 0;
  // DAILY: paying working days in the term; MONTHLY: number of monthly credits (365 days = 12)
  const profitDays = isMonthly
    ? monthlyCreditsForTerm(inv.duration_days)
    : isDaily && start && maturity
    ? profitDaysForTerm(inv, start, maturity)
    : 0;
  const profitCredited = Number(inv.profit_credited) || 0;
  const creditsPerCycle = isDaily ? perCycleCap(inv) ?? null : null;

  // Daily & Monthly plans: which credit are we on, and when does the next credit land?
  let creditedDays = 0;
  let nextCreditAt: string | null = null;
  let nextCreditDue = false;
  let currentCycle = 0;
  let creditsThisCycle = 0;
  if (isDaily && start) {
    const horizon = maturity ?? addDays(new Date(now), OPEN_ENDED_HORIZON_DAYS);
    const payingDays = payingDaysForTerm(inv, start, horizon);
    creditedDays = perDayPaise > 0 ? Math.round(toPaise(profitCredited) / perDayPaise) : 0;
    const stillPaying =
      inv.status === InvestmentStatus.ACTIVE ||
      inv.status === InvestmentStatus.MATURED ||
      inv.status === InvestmentStatus.WITHDRAWAL_REQUESTED;
    const nextDay = payingDays[creditedDays];
    if (stillPaying && nextDay) {
      nextCreditAt = istTimeOnDay(nextDay, PAYOUT_HOUR_IST).toISOString();
      nextCreditDue = nextDay <= latestPayableDay(new Date(now));
    }
    const startKey = istDayKey(start);
    const todayKey = istDayKey(new Date(now));
    currentCycle = todayKey > startKey ? cycleNoForDay(startKey, todayKey) : 0;
    creditsThisCycle = payingDays
      .slice(0, Math.min(creditedDays, payingDays.length))
      .filter((d) => cycleNoForDay(startKey, d) === currentCycle).length;
  } else if (isMonthly && start) {
    const startKey = istDayKey(start);
    const allMonths = monthlyDueDates(startKey, inv.duration_days, '9999-12-31');
    const perMonthPaise = percentOfPaise(amountPaise, inv.profit_value);
    const monthsCredited = perMonthPaise > 0 ? Math.round(toPaise(profitCredited) / perMonthPaise) : 0;
    creditedDays = monthsCredited;
    const stillPaying =
      inv.status === InvestmentStatus.ACTIVE ||
      inv.status === InvestmentStatus.MATURED ||
      inv.status === InvestmentStatus.WITHDRAWAL_REQUESTED;
    const nextMonth = allMonths[monthsCredited];
    if (stillPaying && nextMonth) {
      nextCreditAt = istTimeOnDay(nextMonth.dayKey, PAYOUT_HOUR_IST).toISOString();
      nextCreditDue = nextMonth.dayKey <= latestPayableDay(new Date(now));
    }
  }

  // The fee is charged only when the customer closes the investment before it finishes. A
  // matured investment (or one whose maturity date has passed) returns the capital in full.
  const feePercent = Number(inv.fee_percent) || 0;
  const earlyExitFeeApplies =
    inv.status === InvestmentStatus.ACTIVE && (maturity === null || maturity.getTime() > now);
  const feePaise = earlyExitFeeApplies ? capitalFeePaise(amountPaise, feePercent) : 0;

  return {
    id: inv.id,
    reference: inv.reference,
    userId: inv.user_id,
    planId: inv.plan_id,
    planName: inv.plan_name,
    profitType: inv.profit_type,
    profitValue: inv.profit_value,
    payoutMode: inv.payout_mode,
    rateBasis: inv.rate_basis,
    dailyRatePercent: isDaily ? dailyRatePercent(inv) : 0,
    durationDays: inv.duration_days,
    isOpenEnded,
    lockInDays,
    lockInEndsAt: lockInEndsAt ? lockInEndsAt.toISOString() : null,
    isLocked,
    amount: inv.amount,
    expectedProfit: inv.expected_profit,
    // DAILY plans: profit per working day / week / month, number of paying days, and what has reached the wallet so far
    dailyProfit,
    weeklyProfit,
    monthlyProfit,
    profitDays,
    profitCredited,
    profitRemaining: fromPaise(Math.max(0, toPaise(inv.expected_profit) - toPaise(profitCredited))),
    creditedDays,
    // Monthly plans pay at most 20 credits per 30-day cycle
    creditsPerCycle,
    currentCycle,
    creditsThisCycle,
    nextCreditAt,
    // true when the next credit day has already passed 6:00 AM IST and the job has not caught up yet
    nextCreditDue,
    // Closing the investment before it finishes costs this fee; the customer receives amount - fee.
    // After maturity the fee is 0 and the capital is paid in full.
    feePercent,
    earlyExitFeeApplies,
    capitalWithdrawalFee: fromPaise(feePaise),
    netCapitalOnWithdrawal: fromPaise(amountPaise - feePaise),
    maturityAmount: inv.maturity_amount,
    startDate: toIso(inv.start_date),
    maturityDate: toIso(inv.maturity_date),
    status: inv.status,
    earlyWithdrawalAllowed: Boolean(inv.early_withdrawal_allowed),
    canRequestWithdrawal,
    daysRemaining,
    progressPercent,
    maturedAt: toIso(inv.matured_at),
    completedAt: toIso(inv.completed_at),
    cancelledAt: toIso(inv.cancelled_at),
    cancelReason: inv.cancel_reason,
    createdAt: toIso(inv.created_at),
  };
}

function serializeProfitCredits(inv: Investment) {
  const credits: ProfitCredit[] = (inv as any).profitCredits || [];
  return credits
    .slice()
    .sort((a, b) => (a.credit_day < b.credit_day ? 1 : a.credit_day > b.credit_day ? -1 : 0))
    .map((c) => ({
      id: c.id,
      creditDay: c.credit_day,
      cycleNo: c.cycle_no,
      amount: c.amount,
      creditedAt: toIso(c.created_at),
      walletTransactionId: c.wallet_transaction_id,
    }));
}

function serializeInvestmentWithdrawal(w: Withdrawal) {
  return {
    id: w.id,
    reference: w.reference,
    principalAmount: w.principal_amount,
    profitAmount: w.profit_amount,
    totalAmount: w.total_amount,
    feePercent: w.fee_percent,
    feeAmount: w.fee_amount,
    netAmount: w.net_amount,
    status: w.status,
    isEarly: Boolean(w.is_early),
    rejectionReason: w.rejection_reason,
    createdAt: toIso(w.created_at),
    completedAt: toIso(w.completed_at),
  };
}

function serializeForAdmin(inv: Investment) {
  const u = (inv as any).user;
  return {
    ...serializeInvestment(inv),
    customerName: u?.profile?.full_name || 'N/A',
    customerEmail: u?.email || 'N/A',
    customerPhone: u?.phone || 'N/A',
  };
}

const userInclude = {
  model: User,
  as: 'user',
  attributes: ['id', 'email', 'phone', 'status'],
  include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
};

export class InvestmentService {
  /**
   * Validates an amount against a plan and returns the calculated returns
   */
  private static calculate(plan: InvestmentPlan, amount: number, startDate: Date) {
    const amountPaise = toPaise(amount);

    if (amountPaise < toPaise(plan.min_amount)) {
      throw new BadRequestError(`Minimum investment for ${plan.name} is ${formatInr(plan.min_amount)}`);
    }
    if (amountPaise > toPaise(plan.max_amount)) {
      throw new BadRequestError(`Maximum investment for ${plan.name} is ${formatInr(plan.max_amount)}`);
    }

    // duration_days 0 = open-ended: no maturity, runs until the capital is withdrawn
    const maturityDate = plan.duration_days > 0 ? addDays(startDate, plan.duration_days) : null;
    const profitPaise = calculateProfitPaise(plan, amountPaise, { startDate, maturityDate });

    if (plan.payout_mode === ProfitPayoutMode.DAILY) {
      if (dailyProfitPaise(plan, amountPaise) <= 0) {
        throw new BadRequestError('The amount is too small to earn a daily profit under this plan. Please invest more.');
      }
      if (maturityDate && profitPaise <= 0) {
        throw new BadRequestError(
          'This plan has no working day (Monday-Friday) in its period on which profit could be paid. Please choose another plan.'
        );
      }
    }
    if (plan.payout_mode === ProfitPayoutMode.MONTHLY) {
      const perMonthPaise = percentOfPaise(amountPaise, plan.profit_value);
      if (perMonthPaise <= 0) {
        throw new BadRequestError('The amount is too small to earn a monthly profit under this plan. Please invest more.');
      }
    }

    return {
      amountPaise,
      profitPaise,
      maturityPaise: amountPaise + profitPaise,
      maturityDate,
    };
  }

  private static async getOpenPlan(planId: number): Promise<InvestmentPlan> {
    const plan = await InvestmentPlan.findByPk(planId);
    if (!plan) {
      throw new NotFoundError('Investment plan not found');
    }
    if (!plan.is_active) {
      throw new BadRequestError('This investment plan is currently not accepting new investments.');
    }
    return plan;
  }

  /**
   * Customer: expected profit & maturity for an amount, without investing
   */
  public static async preview(input: InvestInput) {
    const [plan, settings] = await Promise.all([this.getOpenPlan(input.planId), SettingsService.getSettings()]);
    const now = new Date();
    const result = this.calculate(plan, input.amount, now);

    const isDaily = plan.payout_mode === ProfitPayoutMode.DAILY;
    const isMonthly = plan.payout_mode === ProfitPayoutMode.MONTHLY;
    const monthlyProfitAmount = isMonthly
      ? fromPaise(percentOfPaise(result.amountPaise, plan.profit_value))
      : isDaily
      ? fromPaise(monthlyProfitPaise(plan, result.amountPaise))
      : 0;
    // Fee charged only if the customer closes the plan before it finishes
    const feePaise = capitalFeePaise(result.amountPaise, settings.capitalWithdrawalFeePercent);

    return {
      planId: plan.id,
      planName: plan.name,
      amount: fromPaise(result.amountPaise),
      source: input.source,
      durationDays: plan.duration_days,
      isOpenEnded: result.maturityDate === null,
      lockInDays: plan.lock_in_days,
      lockInEndsAt: plan.lock_in_days > 0 ? addDays(now, plan.lock_in_days).toISOString() : null,
      profitType: plan.profit_type,
      profitValue: plan.profit_value,
      payoutMode: plan.payout_mode,
      rateBasis: plan.rate_basis,
      isDaily,
      isMonthly,
      dailyRatePercent: isDaily ? dailyRatePercent(plan) : 0,
      dailyProfit: isDaily ? fromPaise(dailyProfitPaise(plan, result.amountPaise)) : 0,
      weeklyProfit: isDaily ? fromPaise(weeklyProfitPaise(plan, result.amountPaise)) : 0,
      monthlyProfit: monthlyProfitAmount,
      creditsPerCycle: isDaily ? perCycleCap(plan) ?? null : null,
      profitDays: isMonthly
        ? monthlyCreditsForTerm(plan.duration_days)
        : isDaily && result.maturityDate
        ? profitDaysForTerm(plan, now, result.maturityDate)
        : 0,
      payoutHourIst: PAYOUT_HOUR_IST,
      expectedProfit: fromPaise(result.profitPaise),
      maturityAmount: fromPaise(result.maturityPaise),
      feePercent: settings.capitalWithdrawalFeePercent,
      earlyExitFeeApplies: true,
      capitalWithdrawalFee: fromPaise(feePaise),
      netCapitalOnWithdrawal: fromPaise(result.amountPaise - feePaise),
      startDate: now.toISOString(),
      maturityDate: result.maturityDate ? result.maturityDate.toISOString() : null,
    };
  }

  /**
   * Customer: invest from wallet balance. Debit + investment are atomic.
   */
  public static async invest(userId: number, input: InvestInput, meta: RequestMeta = {}) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User account not found');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenError('Only customer accounts can invest.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Only active accounts can invest.');
    }

    const settings = await SettingsService.getSettings();
    if (settings.requireKycForInvestment) {
      const kyc = await KycProfile.findOne({ where: { user_id: userId } });
      if (!kyc || kyc.kyc_status !== KycStatus.VERIFIED) {
        throw new ForbiddenError('KYC verification is required before you can invest.');
      }
    }

    const investment = await sequelize.transaction(async (t) => {
      const plan = await InvestmentPlan.findByPk(input.planId, { transaction: t });
      if (!plan) {
        throw new NotFoundError('Investment plan not found');
      }
      if (!plan.is_active) {
        throw new BadRequestError('This investment plan is currently not accepting new investments.');
      }

      const startDate = new Date();
      const result = this.calculate(plan, input.amount, startDate);

      const created = await Investment.create(
        {
          reference: generateReference('INV'),
          user_id: userId,
          plan_id: plan.id,
          plan_name: plan.name,
          profit_type: plan.profit_type,
          profit_value: plan.profit_value,
          payout_mode: plan.payout_mode,
          rate_basis: plan.rate_basis,
          lock_in_days: plan.lock_in_days,
          fee_percent: settings.capitalWithdrawalFeePercent,
          duration_days: plan.duration_days,
          amount: fromPaise(result.amountPaise),
          expected_profit: fromPaise(result.profitPaise),
          profit_credited: 0,
          maturity_amount: fromPaise(result.maturityPaise),
          start_date: startDate,
          maturity_date: result.maturityDate,
          status: InvestmentStatus.ACTIVE,
        },
        { transaction: t }
      );

      // Paid from the chosen bucket; re-invested profit becomes capital from here on.
      // Throws on insufficient balance, which rolls the investment back.
      await WalletService.applyEntry(
        {
          userId,
          type: WalletTxnType.INVESTMENT,
          direction: WalletTxnDirection.DEBIT,
          bucket: input.source,
          amountPaise: result.amountPaise,
          description: `Investment in ${plan.name} (${created.reference}) from ${BUCKET_LABELS[input.source]}`,
          relatedEntity: 'INVESTMENT',
          relatedId: created.id,
        },
        t
      );

      // Referral commission for the customer who referred this investor: a one-time
      // percentage of the amount, credited to the referrer's PROFIT wallet instantly,
      // in the same transaction as the investment.
      if (settings.referralCommissionPercent > 0) {
        const referral = await Referral.findOne({ where: { referred_user_id: userId }, transaction: t });
        const referrer = referral ? await User.findByPk(referral.referrer_user_id, { attributes: ['id', 'status', 'role'], transaction: t }) : null;
        const referrerEligible =
          referral !== null &&
          referral.referrer_user_id !== userId &&
          referrer !== null &&
          referrer.role === UserRole.CUSTOMER &&
          referrer.status === UserStatus.ACTIVE;
        if (referral && !referrerEligible) {
          logger.warn(`[REFERRAL] No commission on investment ${created.reference}: referrer #${referral.referrer_user_id} is not an active customer`);
        }
        if (referral && referrerEligible) {
          const commissionPaise = percentOfPaise(result.amountPaise, settings.referralCommissionPercent);
          if (commissionPaise > 0) {
            const now = new Date();
            const commission = await ReferralCommission.create(
              {
                referrer_user_id: referral.referrer_user_id,
                referred_user_id: userId,
                investment_id: created.id,
                investment_amount: fromPaise(result.amountPaise),
                commission_percent: settings.referralCommissionPercent,
                amount: fromPaise(commissionPaise),
                status: ReferralCommissionStatus.CREDITED,
                eligible_at: now,
                credited_at: now,
              },
              { transaction: t }
            );
            const txn = await WalletService.applyEntry(
              {
                userId: referral.referrer_user_id,
                type: WalletTxnType.REFERRAL_COMMISSION,
                direction: WalletTxnDirection.CREDIT,
                bucket: WalletBucket.PROFIT,
                amountPaise: commissionPaise,
                description: `Referral commission (${settings.referralCommissionPercent}%) on investment ${created.reference} by referred customer #${userId}`,
                relatedEntity: 'REFERRAL_COMMISSION',
                relatedId: commission.id,
              },
              t
            );
            commission.wallet_transaction_id = txn.id;
            await commission.save({ transaction: t });
            (created as any).referralCommission = commission;
          }
        }
      }

      return created;
    });

    const paidCommission: ReferralCommission | undefined = (investment as any).referralCommission;
    if (paidCommission) {
      const referredName = (user as any).profile?.full_name || 'a customer you referred';
      await ActivityLogService.log({
        userId: paidCommission.referrer_user_id,
        action: 'REFERRAL_COMMISSION_CREDITED',
        entity: 'REFERRAL_COMMISSION',
        entityId: paidCommission.id,
        description: `Referral commission of ${formatInr(paidCommission.amount)} credited to user #${paidCommission.referrer_user_id} for investment ${investment.reference} of user #${userId}`,
      });
      await NotificationService.notify({
        userId: paidCommission.referrer_user_id,
        type: NotificationType.REFERRAL_COMMISSION,
        title: 'Referral commission credited',
        message: `${formatInr(paidCommission.amount)} referral commission (${paidCommission.commission_percent}% of ${formatInr(
          paidCommission.investment_amount
        )} invested by ${referredName}) has been credited to your profit wallet.`,
        relatedEntity: 'REFERRAL_COMMISSION',
        relatedId: paidCommission.id,
      });
    }

    await ActivityLogService.log({
      userId,
      action: 'INVESTMENT_CREATED',
      entity: 'INVESTMENT',
      entityId: investment.id,
      description: `User #${userId} invested ${formatInr(investment.amount)} in ${investment.plan_name} (${investment.reference})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const serialized = serializeInvestment(investment);

    await NotificationService.notify({
      userId,
      type: NotificationType.INVESTMENT_CONFIRMED,
      title: 'Investment confirmed',
      message:
        investment.payout_mode === ProfitPayoutMode.DAILY
          ? `Your investment of ${formatInr(investment.amount)} in ${investment.plan_name} (${investment.reference}) is active. ${formatInr(
              serialized.dailyProfit
            )} profit will be credited to your profit wallet every working day (Mon-Fri) at ${PAYOUT_HOUR_IST}:00 AM, about ${formatInr(
              serialized.monthlyProfit
            )} a month${
              serialized.isOpenEnded
                ? ', for as long as your capital stays invested.'
                : ` and ${formatInr(investment.expected_profit)} in total over ${serialized.profitDays} working days. Your capital returns to your capital wallet at maturity.`
            }`
          : investment.payout_mode === ProfitPayoutMode.MONTHLY
          ? `Your investment of ${formatInr(investment.amount)} in ${investment.plan_name} (${investment.reference}) is active. ${formatInr(
              serialized.monthlyProfit
            )} profit (${investment.profit_value}% of your capital) will be credited to your profit wallet every month on your start date at ${PAYOUT_HOUR_IST}:00 AM, ${formatInr(
              investment.expected_profit
            )} in total over ${serialized.profitDays} months. Your capital returns to your capital wallet at maturity.`
          : `Your investment of ${formatInr(investment.amount)} in ${investment.plan_name} (${investment.reference}) is active. Expected maturity amount: ${formatInr(
              investment.maturity_amount
            )}.`,
      relatedEntity: 'INVESTMENT',
      relatedId: investment.id,
    });

    return serialized;
  }

  /**
   * Settles every ACTIVE investment past its maturity date: the remaining daily profit is
   * credited, the capital returns to the customer's capital wallet (maturity-paid plans also
   * credit their profit to the profit wallet) and the investment is COMPLETED. From the capital
   * wallet the customer can re-invest or withdraw it in full, without fee.
   * Safe to run concurrently: rows are locked and the status re-checked inside the transaction.
   */
  public static async matureDueInvestments(userId?: number): Promise<number> {
    const now = new Date();
    const where: any = {
      status: InvestmentStatus.ACTIVE,
      maturity_date: { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: now }] },
    };
    if (userId) where.user_id = userId;

    const due = await Investment.findAll({ where });
    let matured = 0;

    for (const inv of due) {
      const maturity = parseDbDate(inv.maturity_date);
      if (!maturity) continue;

      // Pay the last profit days and the referrer's last daily commissions first (own transactions, idempotent)
      await DailyPayoutService.creditInvestmentUpTo(inv, istDayKey(maturity));
      await DailyPayoutService.creditReferralCommissionUpTo(inv, istDayKey(maturity), { notify: true });

      const settled = await sequelize.transaction(async (t) => {
        const fresh = await Investment.findByPk(inv.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!fresh || fresh.status !== InvestmentStatus.ACTIVE) return null;

        await WalletService.applyEntry(
          {
            userId: fresh.user_id,
            type: WalletTxnType.MATURITY_PRINCIPAL,
            direction: WalletTxnDirection.CREDIT,
            bucket: WalletBucket.CAPITAL,
            amountPaise: toPaise(fresh.amount),
            description: `Capital returned at maturity of investment ${fresh.reference} (${fresh.plan_name})`,
            relatedEntity: 'INVESTMENT',
            relatedId: fresh.id,
          },
          t
        );

        const profitPaise = fresh.payout_mode === ProfitPayoutMode.AT_MATURITY ? toPaise(fresh.expected_profit) : 0;
        if (profitPaise > 0) {
          await WalletService.applyEntry(
            {
              userId: fresh.user_id,
              type: WalletTxnType.PROFIT,
              direction: WalletTxnDirection.CREDIT,
              bucket: WalletBucket.PROFIT,
              amountPaise: profitPaise,
              description: `Profit earned on investment ${fresh.reference} (${fresh.plan_name})`,
              relatedEntity: 'INVESTMENT',
              relatedId: fresh.id,
            },
            t
          );
          await Investment.increment({ profit_credited: fromPaise(profitPaise) }, { where: { id: fresh.id }, transaction: t });
        }

        fresh.status = InvestmentStatus.COMPLETED;
        fresh.matured_at = now;
        fresh.completed_at = now;
        fresh.early_withdrawal_allowed = false;
        await fresh.save({ transaction: t });
        return { profitPaise };
      });
      if (!settled) continue;

      matured += 1;

      await ActivityLogService.log({
        action: 'INVESTMENT_MATURED',
        entity: 'INVESTMENT',
        entityId: inv.id,
        description: `Investment ${inv.reference} of customer #${inv.user_id} matured; ${formatInr(
          inv.amount
        )} capital returned to the capital wallet${
          settled.profitPaise > 0 ? ` and ${formatInr(fromPaise(settled.profitPaise))} profit credited` : ''
        }`,
      });

      await NotificationService.notify({
        userId: inv.user_id,
        type: NotificationType.INVESTMENT_MATURED,
        title: 'Investment matured',
        message: `Your investment ${inv.reference} in ${inv.plan_name} has matured. Your capital of ${formatInr(
          inv.amount
        )} is back in your capital wallet${
          settled.profitPaise > 0 ? ` and ${formatInr(fromPaise(settled.profitPaise))} profit is in your profit wallet` : ''
        }. Re-invest it in a plan to keep earning, or withdraw it to your bank account in full, no fee.`,
        relatedEntity: 'INVESTMENT',
        relatedId: inv.id,
      });
    }

    if (matured > 0) {
      logger.info(`[MATURITY] ${matured} investment(s) settled and completed`);
    }
    return matured;
  }

  private static buildWhere(params: InvestmentFilterParams) {
    const where: any = {};

    if (params.status && Object.values(InvestmentStatus).includes(params.status as InvestmentStatus)) {
      where.status = params.status;
    }

    const planId = Number(params.planId);
    if (Number.isInteger(planId) && planId > 0) {
      where.plan_id = planId;
    }

    const { start, end } = parseDateRange(params.startDate, params.endDate);
    if (start && end) where.created_at = { [Op.between]: [start, end] };
    else if (start) where.created_at = { [Op.gte]: start };
    else if (end) where.created_at = { [Op.lte]: end };

    return where;
  }

  public static async listUserInvestments(userId: number, params: InvestmentFilterParams) {
    await this.matureDueInvestments(userId);

    const { page, limit, offset } = getPagination(params, 10);
    const where = { ...this.buildWhere(params), user_id: userId };

    const { count, rows } = await Investment.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return { investments: rows.map(serializeInvestment), meta: buildMeta(page, limit, count) };
  }

  public static async getUserInvestment(userId: number, investmentId: number) {
    await this.matureDueInvestments(userId);

    const investment = await Investment.findOne({
      where: { id: investmentId, user_id: userId },
      include: [
        { model: Withdrawal, as: 'withdrawals' },
        { model: ProfitCredit, as: 'profitCredits' },
      ],
    });
    if (!investment) {
      throw new NotFoundError('Investment not found');
    }

    const withdrawals: Withdrawal[] = (investment as any).withdrawals || [];

    return {
      ...serializeInvestment(investment),
      profitCredits: serializeProfitCredits(investment),
      withdrawals: withdrawals.sort((a, b) => b.id - a.id).map(serializeInvestmentWithdrawal),
    };
  }

  public static async adminListInvestments(params: InvestmentFilterParams) {
    await this.matureDueInvestments();

    const { page, limit, offset } = getPagination(params, 10);
    const where = this.buildWhere(params);

    const userId = Number(params.userId);
    if (Number.isInteger(userId) && userId > 0) {
      where.user_id = userId;
    }

    // Maturity monitor: active investments maturing within the next N days
    const maturingInDays = Number(params.maturingInDays);
    if (Number.isFinite(maturingInDays) && maturingInDays > 0) {
      where.status = InvestmentStatus.ACTIVE;
      where.maturity_date = { [Op.lte]: addDays(new Date(), Math.min(maturingInDays, 3650)) };
    }

    const search = params.search?.trim();
    if (search) {
      where[Op.or] = [
        { reference: { [Op.like]: `%${search}%` } },
        { plan_name: { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
        { '$user.phone$': { [Op.like]: `%${search}%` } },
        { '$user.profile.full_name$': { [Op.like]: `%${search}%` } },
      ];
    }

    const orderByMaturity = where.maturity_date !== undefined;

    const { count, rows } = await Investment.findAndCountAll({
      where,
      limit,
      offset,
      subQuery: false,
      order: orderByMaturity
        ? [
            ['maturity_date', 'ASC'],
            ['id', 'ASC'],
          ]
        : [
            ['created_at', 'DESC'],
            ['id', 'DESC'],
          ],
      include: [userInclude],
    });

    const statusCounts = await Promise.all(
      Object.values(InvestmentStatus).map(async (status) => [status, await Investment.count({ where: { status } })])
    );

    return {
      investments: rows.map(serializeForAdmin),
      meta: { ...buildMeta(page, limit, count), counts: Object.fromEntries(statusCounts) },
    };
  }

  public static async adminGetInvestment(investmentId: number) {
    await this.matureDueInvestments();

    const investment = await Investment.findByPk(investmentId, {
      include: [userInclude, { model: Withdrawal, as: 'withdrawals' }, { model: ProfitCredit, as: 'profitCredits' }],
    });
    if (!investment) {
      throw new NotFoundError('Investment not found');
    }

    const withdrawals: Withdrawal[] = (investment as any).withdrawals || [];

    return {
      ...serializeForAdmin(investment),
      profitCredits: serializeProfitCredits(investment),
      withdrawals: withdrawals.sort((a, b) => b.id - a.id).map(serializeInvestmentWithdrawal),
    };
  }

  /**
   * Admin: cancel an ACTIVE investment and refund the principal to the wallet
   */
  public static async cancelInvestment(
    investmentId: number,
    adminId: number,
    reason: string,
    meta: RequestMeta = {}
  ) {
    const investment = await sequelize.transaction(async (t) => {
      const inv = await Investment.findByPk(investmentId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!inv) {
        throw new NotFoundError('Investment not found');
      }
      if (inv.status !== InvestmentStatus.ACTIVE) {
        throw new BadRequestError(
          `Only active investments can be cancelled. This investment is ${inv.status.replace(/_/g, ' ').toLowerCase()}.`
        );
      }

      await WalletService.applyEntry(
        {
          userId: inv.user_id,
          type: WalletTxnType.REFUND,
          direction: WalletTxnDirection.CREDIT,
          bucket: WalletBucket.CAPITAL,
          amountPaise: toPaise(inv.amount),
          description: `Capital refunded for cancelled investment ${inv.reference}`,
          relatedEntity: 'INVESTMENT',
          relatedId: inv.id,
          createdBy: adminId,
        },
        t
      );

      inv.status = InvestmentStatus.CANCELLED;
      inv.cancelled_at = new Date();
      inv.cancel_reason = reason.trim();
      inv.early_withdrawal_allowed = false;
      await inv.save({ transaction: t });

      // A referral commission that has not been paid yet is forfeited with the investment
      await ReferralCommission.update(
        { status: ReferralCommissionStatus.CANCELLED, cancelled_at: new Date() },
        { where: { investment_id: inv.id, status: ReferralCommissionStatus.PENDING }, transaction: t }
      );
      // A commission already paid to the referrer is taken back from their profit wallet when
      // it still holds enough; otherwise it is left as paid and noted in the log.
      const paid = await ReferralCommission.findAll({
        where: { investment_id: inv.id, status: ReferralCommissionStatus.CREDITED },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      for (const commission of paid) {
        const referrerWallet = await WalletService.getLockedWallet(commission.referrer_user_id, t);
        const amountPaise = toPaise(commission.amount);
        if (toPaise(referrerWallet.profit_balance) < amountPaise) {
          logger.warn(
            `[INVESTMENT] Commission #${commission.id} (${formatInr(commission.amount)}) on cancelled investment ${inv.reference} was not reversed: referrer #${commission.referrer_user_id} has insufficient profit balance`
          );
          continue;
        }
        await WalletService.applyEntry(
          {
            userId: commission.referrer_user_id,
            type: WalletTxnType.REFERRAL_COMMISSION,
            direction: WalletTxnDirection.DEBIT,
            bucket: WalletBucket.PROFIT,
            amountPaise,
            description: `Referral commission reversed: investment ${inv.reference} was cancelled`,
            relatedEntity: 'REFERRAL_COMMISSION',
            relatedId: commission.id,
            createdBy: adminId,
          },
          t
        );
        commission.status = ReferralCommissionStatus.CANCELLED;
        commission.cancelled_at = new Date();
        await commission.save({ transaction: t });
      }
      return inv;
    });

    await ActivityLogService.log({
      userId: adminId,
      action: 'INVESTMENT_CANCELLED',
      entity: 'INVESTMENT',
      entityId: investment.id,
      description: `Admin #${adminId} cancelled investment ${investment.reference} and refunded ${formatInr(
        investment.amount
      )} to customer #${investment.user_id} capital wallet. Reason: ${reason}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: investment.user_id,
      type: NotificationType.INVESTMENT_CANCELLED,
      title: 'Investment cancelled',
      message: `Your investment ${investment.reference} was cancelled and ${formatInr(
        investment.amount
      )} was refunded to your capital wallet. Reason: ${reason}`,
      relatedEntity: 'INVESTMENT',
      relatedId: investment.id,
    });

    return serializeInvestment(investment);
  }

  /**
   * Admin: allow / disallow withdrawing an investment before maturity
   */
  public static async setEarlyWithdrawal(
    investmentId: number,
    allowed: boolean,
    adminId: number,
    meta: RequestMeta = {}
  ) {
    const investment = await sequelize.transaction(async (t) => {
      const inv = await Investment.findByPk(investmentId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!inv) {
        throw new NotFoundError('Investment not found');
      }
      if (inv.status !== InvestmentStatus.ACTIVE) {
        throw new BadRequestError('Early withdrawal can only be configured for active investments.');
      }

      inv.early_withdrawal_allowed = allowed;
      await inv.save({ transaction: t });
      return inv;
    });

    await ActivityLogService.log({
      userId: adminId,
      action: allowed ? 'EARLY_WITHDRAWAL_ALLOWED' : 'EARLY_WITHDRAWAL_REVOKED',
      entity: 'INVESTMENT',
      entityId: investment.id,
      description: `Admin #${adminId} ${allowed ? 'allowed' : 'revoked'} early withdrawal for investment ${investment.reference}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return serializeInvestment(investment);
  }
}
