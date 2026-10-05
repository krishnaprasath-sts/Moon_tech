import { Op } from 'sequelize';
import {
  sequelize,
  Investment,
  InvestmentPlan,
  Withdrawal,
  User,
  CustomerProfile,
  KycProfile,
} from '../models/index.js';
import {
  InvestmentStatus,
  WalletTxnType,
  WalletTxnDirection,
  NotificationType,
  UserRole,
  UserStatus,
  KycStatus,
} from '../types/index.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise, formatInr, generateReference } from '../utils/money.js';
import { toIso, parseDbDate, addDays, parseDateRange } from '../utils/dates.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { SettingsService } from './settingsService.js';
import { WalletService } from './walletService.js';
import { calculateProfitPaise } from './investmentPlanService.js';
import { InvestInput } from '../validators/financeValidators.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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

  let progressPercent = 100;
  let daysRemaining = 0;
  if (start && maturity && inv.status === InvestmentStatus.ACTIVE) {
    const total = maturity.getTime() - start.getTime();
    const elapsed = Math.max(0, Math.min(now - start.getTime(), total));
    progressPercent = total > 0 ? Math.round((elapsed / total) * 1000) / 10 : 100;
    daysRemaining = Math.max(0, Math.ceil((maturity.getTime() - now) / DAY_MS));
  }

  const canRequestWithdrawal =
    inv.status === InvestmentStatus.MATURED ||
    (inv.status === InvestmentStatus.ACTIVE && Boolean(inv.early_withdrawal_allowed));

  return {
    id: inv.id,
    reference: inv.reference,
    userId: inv.user_id,
    planId: inv.plan_id,
    planName: inv.plan_name,
    profitType: inv.profit_type,
    profitValue: inv.profit_value,
    durationDays: inv.duration_days,
    amount: inv.amount,
    expectedProfit: inv.expected_profit,
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

    const profitPaise = calculateProfitPaise(plan, amountPaise);

    return {
      amountPaise,
      profitPaise,
      maturityPaise: amountPaise + profitPaise,
      maturityDate: addDays(startDate, plan.duration_days),
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
    const plan = await this.getOpenPlan(input.planId);
    const now = new Date();
    const result = this.calculate(plan, input.amount, now);

    return {
      planId: plan.id,
      planName: plan.name,
      amount: fromPaise(result.amountPaise),
      durationDays: plan.duration_days,
      profitType: plan.profit_type,
      profitValue: plan.profit_value,
      expectedProfit: fromPaise(result.profitPaise),
      maturityAmount: fromPaise(result.maturityPaise),
      startDate: now.toISOString(),
      maturityDate: result.maturityDate.toISOString(),
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
          duration_days: plan.duration_days,
          amount: fromPaise(result.amountPaise),
          expected_profit: fromPaise(result.profitPaise),
          maturity_amount: fromPaise(result.maturityPaise),
          start_date: startDate,
          maturity_date: result.maturityDate,
          status: InvestmentStatus.ACTIVE,
        },
        { transaction: t }
      );

      // Throws on insufficient balance, which rolls the investment back
      await WalletService.applyEntry(
        {
          userId,
          type: WalletTxnType.INVESTMENT,
          direction: WalletTxnDirection.DEBIT,
          amountPaise: result.amountPaise,
          description: `Investment in ${plan.name} (${created.reference})`,
          relatedEntity: 'INVESTMENT',
          relatedId: created.id,
        },
        t
      );

      return created;
    });

    await ActivityLogService.log({
      userId,
      action: 'INVESTMENT_CREATED',
      entity: 'INVESTMENT',
      entityId: investment.id,
      description: `User #${userId} invested ${formatInr(investment.amount)} in ${investment.plan_name} (${investment.reference})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId,
      type: NotificationType.INVESTMENT_CONFIRMED,
      title: 'Investment confirmed',
      message: `Your investment of ${formatInr(investment.amount)} in ${investment.plan_name} (${investment.reference}) is active. Expected maturity amount: ${formatInr(
        investment.maturity_amount
      )}.`,
      relatedEntity: 'INVESTMENT',
      relatedId: investment.id,
    });

    return serializeInvestment(investment);
  }

  /**
   * Moves every ACTIVE investment past its maturity date to MATURED.
   * Safe to run concurrently: the status guard makes each update idempotent.
   */
  public static async matureDueInvestments(userId?: number): Promise<number> {
    const now = new Date();
    const where: any = {
      status: InvestmentStatus.ACTIVE,
      maturity_date: { [Op.lte]: now },
    };
    if (userId) where.user_id = userId;

    const due = await Investment.findAll({ where });
    let matured = 0;

    for (const inv of due) {
      const [updated] = await Investment.update(
        { status: InvestmentStatus.MATURED, matured_at: now },
        { where: { id: inv.id, status: InvestmentStatus.ACTIVE } }
      );
      if (updated === 0) continue;

      matured += 1;

      await ActivityLogService.log({
        action: 'INVESTMENT_MATURED',
        entity: 'INVESTMENT',
        entityId: inv.id,
        description: `Investment ${inv.reference} of customer #${inv.user_id} matured (${formatInr(inv.maturity_amount)} payable)`,
      });

      await NotificationService.notify({
        userId: inv.user_id,
        type: NotificationType.INVESTMENT_MATURED,
        title: 'Investment matured',
        message: `Your investment ${inv.reference} in ${inv.plan_name} has matured. ${formatInr(
          inv.maturity_amount
        )} is ready - submit a withdrawal request to receive it.`,
        relatedEntity: 'INVESTMENT',
        relatedId: inv.id,
      });
    }

    if (matured > 0) {
      logger.info(`[MATURITY] ${matured} investment(s) moved to MATURED`);
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
      include: [{ model: Withdrawal, as: 'withdrawals' }],
    });
    if (!investment) {
      throw new NotFoundError('Investment not found');
    }

    const withdrawals: Withdrawal[] = (investment as any).withdrawals || [];

    return {
      ...serializeInvestment(investment),
      withdrawals: withdrawals
        .sort((a, b) => b.id - a.id)
        .map((w) => ({
          id: w.id,
          reference: w.reference,
          totalAmount: w.total_amount,
          status: w.status,
          rejectionReason: w.rejection_reason,
          createdAt: toIso(w.created_at),
          completedAt: toIso(w.completed_at),
        })),
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
      include: [userInclude, { model: Withdrawal, as: 'withdrawals' }],
    });
    if (!investment) {
      throw new NotFoundError('Investment not found');
    }

    const withdrawals: Withdrawal[] = (investment as any).withdrawals || [];

    return {
      ...serializeForAdmin(investment),
      withdrawals: withdrawals
        .sort((a, b) => b.id - a.id)
        .map((w) => ({
          id: w.id,
          reference: w.reference,
          principalAmount: w.principal_amount,
          profitAmount: w.profit_amount,
          totalAmount: w.total_amount,
          status: w.status,
          isEarly: Boolean(w.is_early),
          createdAt: toIso(w.created_at),
          completedAt: toIso(w.completed_at),
        })),
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
          amountPaise: toPaise(inv.amount),
          description: `Refund for cancelled investment ${inv.reference}`,
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
      return inv;
    });

    await ActivityLogService.log({
      userId: adminId,
      action: 'INVESTMENT_CANCELLED',
      entity: 'INVESTMENT',
      entityId: investment.id,
      description: `Admin #${adminId} cancelled investment ${investment.reference} and refunded ${formatInr(
        investment.amount
      )} to customer #${investment.user_id} wallet. Reason: ${reason}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: investment.user_id,
      type: NotificationType.INVESTMENT_CANCELLED,
      title: 'Investment cancelled',
      message: `Your investment ${investment.reference} was cancelled and ${formatInr(
        investment.amount
      )} was refunded to your wallet. Reason: ${reason}`,
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
