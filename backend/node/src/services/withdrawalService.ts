import { Op } from 'sequelize';
import {
  sequelize,
  Withdrawal,
  Investment,
  User,
  CustomerProfile,
  UserPayoutDetail,
} from '../models/index.js';
import {
  WithdrawalStatus,
  InvestmentStatus,
  PayoutMethod,
  WalletTxnType,
  WalletTxnDirection,
  NotificationType,
  UserRole,
  UserStatus,
  JwtUserPayload,
} from '../types/index.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise, formatInr, generateReference } from '../utils/money.js';
import { decryptData } from '../utils/encryption.js';
import { maskBankAccount } from '../utils/mask.js';
import { toIso, parseDbDate, parseDateRange } from '../utils/dates.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { WalletService } from './walletService.js';
import { FileService } from './fileService.js';
import {
  RequestWithdrawalInput,
  ApproveWithdrawalInput,
  CompleteWithdrawalInput,
} from '../validators/financeValidators.js';

export interface WithdrawalFilterParams {
  page?: unknown;
  limit?: unknown;
  status?: string;
  search?: string;
  userId?: unknown;
  startDate?: string;
  endDate?: string;
}

function serialize(w: Withdrawal) {
  const inv: Investment | undefined = (w as any).investment;
  return {
    id: w.id,
    reference: w.reference,
    userId: w.user_id,
    investmentId: w.investment_id,
    investmentReference: inv?.reference || null,
    planName: inv?.plan_name || null,
    principalAmount: w.principal_amount,
    profitAmount: w.profit_amount,
    totalAmount: w.total_amount,
    isEarly: Boolean(w.is_early),
    payoutMethod: w.payout_method,
    payoutUpiId: w.payout_upi_id,
    payoutAccountHolder: w.payout_account_holder,
    payoutAccountMasked: w.payout_account_last4 ? maskBankAccount(`XXXXXXXX${w.payout_account_last4}`) : null,
    payoutIfsc: w.payout_ifsc,
    payoutBankName: w.payout_bank_name,
    status: w.status,
    rejectionReason: w.rejection_reason,
    paymentReference: w.payment_reference,
    hasPaymentProof: Boolean(w.payment_proof_file),
    reviewedAt: toIso(w.reviewed_at),
    completedAt: toIso(w.completed_at),
    createdAt: toIso(w.created_at),
  };
}

function serializeForAdmin(w: Withdrawal) {
  const u = (w as any).user;
  return {
    ...serialize(w),
    adminRemarks: w.admin_remarks,
    customerName: u?.profile?.full_name || 'N/A',
    customerEmail: u?.email || 'N/A',
    customerPhone: u?.phone || 'N/A',
  };
}

const investmentInclude = {
  model: Investment,
  as: 'investment',
  attributes: [
    'id',
    'reference',
    'plan_name',
    'amount',
    'expected_profit',
    'maturity_amount',
    'start_date',
    'maturity_date',
    'status',
    'duration_days',
  ],
};

const userInclude = {
  model: User,
  as: 'user',
  attributes: ['id', 'email', 'phone', 'status'],
  include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
};

export class WithdrawalService {
  /**
   * Customer: request payout of a matured investment (or an active one the
   * admin has explicitly opened for early withdrawal).
   */
  public static async requestWithdrawal(
    userId: number,
    investmentId: number,
    input: RequestWithdrawalInput,
    meta: RequestMeta = {}
  ) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User account not found');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenError('Only customer accounts can request withdrawals.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Only active accounts can request withdrawals.');
    }

    const payout = await UserPayoutDetail.findOne({ where: { user_id: userId } });
    if (!payout) {
      throw new BadRequestError('Add your bank or UPI details in your profile before requesting a withdrawal.');
    }

    const method = input.payoutMethod ?? payout.preferred_method;
    if (method === PayoutMethod.UPI && !payout.upi_id) {
      throw new BadRequestError('No UPI ID is registered. Update your payout details first.');
    }
    if (
      method === PayoutMethod.BANK &&
      (!payout.account_number_encrypted || !payout.ifsc_code || !payout.account_holder_name)
    ) {
      throw new BadRequestError('Bank details are incomplete. Update your payout details first.');
    }

    const withdrawal = await sequelize.transaction(async (t) => {
      const inv = await Investment.findOne({
        where: { id: investmentId, user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!inv) {
        throw new NotFoundError('Investment not found');
      }

      const maturityDate = parseDbDate(inv.maturity_date);
      const hasMatured =
        inv.status === InvestmentStatus.MATURED ||
        (inv.status === InvestmentStatus.ACTIVE && maturityDate !== null && maturityDate.getTime() <= Date.now());

      if (inv.status === InvestmentStatus.WITHDRAWAL_REQUESTED) {
        throw new ConflictError('A withdrawal request already exists for this investment.');
      }
      if (inv.status === InvestmentStatus.COMPLETED || inv.status === InvestmentStatus.CANCELLED) {
        throw new BadRequestError(`This investment is already ${inv.status.toLowerCase()}.`);
      }

      const isEarly = !hasMatured;
      if (isEarly && !inv.early_withdrawal_allowed) {
        throw new ForbiddenError(
          `This investment is still active and matures on ${maturityDate?.toDateString() ?? 'its maturity date'}. It can be withdrawn after maturity.`
        );
      }

      const principalPaise = toPaise(inv.amount);
      // Profit is only earned by completing the full period
      const profitPaise = isEarly ? 0 : toPaise(inv.expected_profit);

      const created = await Withdrawal.create(
        {
          reference: generateReference('WDR'),
          user_id: userId,
          investment_id: inv.id,
          principal_amount: fromPaise(principalPaise),
          profit_amount: fromPaise(profitPaise),
          total_amount: fromPaise(principalPaise + profitPaise),
          is_early: isEarly,
          payout_method: method,
          payout_upi_id: method === PayoutMethod.UPI ? payout.upi_id : null,
          payout_account_holder: method === PayoutMethod.BANK ? payout.account_holder_name : null,
          payout_account_number_encrypted: method === PayoutMethod.BANK ? payout.account_number_encrypted : null,
          payout_account_last4: method === PayoutMethod.BANK ? payout.account_last4 : null,
          payout_ifsc: method === PayoutMethod.BANK ? payout.ifsc_code : null,
          payout_bank_name: method === PayoutMethod.BANK ? payout.bank_name : null,
          status: WithdrawalStatus.PENDING,
        },
        { transaction: t }
      );

      if (!isEarly && inv.status === InvestmentStatus.ACTIVE) {
        inv.matured_at = new Date();
      }
      inv.status = InvestmentStatus.WITHDRAWAL_REQUESTED;
      await inv.save({ transaction: t });

      (created as any).investment = inv;
      return created;
    });

    await ActivityLogService.log({
      userId,
      action: 'WITHDRAWAL_REQUESTED',
      entity: 'WITHDRAWAL',
      entityId: withdrawal.id,
      description: `User #${userId} requested withdrawal ${withdrawal.reference} of ${formatInr(
        withdrawal.total_amount
      )} for investment #${withdrawal.investment_id}${withdrawal.is_early ? ' (early withdrawal)' : ''}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId,
      type: NotificationType.WITHDRAWAL_REQUESTED,
      title: 'Withdrawal request received',
      message: `Your withdrawal request ${withdrawal.reference} for ${formatInr(
        withdrawal.total_amount
      )} has been received and is awaiting review.`,
      relatedEntity: 'WITHDRAWAL',
      relatedId: withdrawal.id,
    });

    return serialize(withdrawal);
  }

  private static buildWhere(params: WithdrawalFilterParams) {
    const where: any = {};

    if (params.status && Object.values(WithdrawalStatus).includes(params.status as WithdrawalStatus)) {
      where.status = params.status;
    }

    const { start, end } = parseDateRange(params.startDate, params.endDate);
    if (start && end) where.created_at = { [Op.between]: [start, end] };
    else if (start) where.created_at = { [Op.gte]: start };
    else if (end) where.created_at = { [Op.lte]: end };

    return where;
  }

  public static async listUserWithdrawals(userId: number, params: WithdrawalFilterParams) {
    const { page, limit, offset } = getPagination(params, 10);
    const where = { ...this.buildWhere(params), user_id: userId };

    const { count, rows } = await Withdrawal.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [investmentInclude],
    });

    return { withdrawals: rows.map(serialize), meta: buildMeta(page, limit, count) };
  }

  public static async adminListWithdrawals(params: WithdrawalFilterParams) {
    const { page, limit, offset } = getPagination(params, 10);
    const where = this.buildWhere(params);

    const userId = Number(params.userId);
    if (Number.isInteger(userId) && userId > 0) {
      where.user_id = userId;
    }

    const search = params.search?.trim();
    if (search) {
      where[Op.or] = [
        { reference: { [Op.like]: `%${search}%` } },
        { payment_reference: { [Op.like]: `%${search}%` } },
        { '$investment.reference$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
        { '$user.phone$': { [Op.like]: `%${search}%` } },
        { '$user.profile.full_name$': { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Withdrawal.findAndCountAll({
      where,
      limit,
      offset,
      subQuery: false,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [userInclude, investmentInclude],
    });

    const statusCounts = await Promise.all(
      Object.values(WithdrawalStatus).map(async (status) => [status, await Withdrawal.count({ where: { status } })])
    );

    return {
      withdrawals: rows.map(serializeForAdmin),
      meta: { ...buildMeta(page, limit, count), counts: Object.fromEntries(statusCounts) },
    };
  }

  /**
   * Admin detail. The full account number is only revealed to roles that can
   * actually process the payout.
   */
  public static async adminGetWithdrawal(withdrawalId: number, requestingUser: JwtUserPayload) {
    const withdrawal = await Withdrawal.findByPk(withdrawalId, {
      include: [userInclude, investmentInclude],
    });
    if (!withdrawal) {
      throw new NotFoundError('Withdrawal request not found');
    }

    const canProcess = [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(requestingUser.role);
    const inv: Investment | undefined = (withdrawal as any).investment;

    return {
      ...serializeForAdmin(withdrawal),
      payoutAccountNumber:
        canProcess && withdrawal.payout_account_number_encrypted
          ? decryptData(withdrawal.payout_account_number_encrypted)
          : null,
      investment: inv
        ? {
            id: inv.id,
            reference: inv.reference,
            planName: inv.plan_name,
            amount: inv.amount,
            expectedProfit: inv.expected_profit,
            maturityAmount: inv.maturity_amount,
            durationDays: inv.duration_days,
            startDate: toIso(inv.start_date),
            maturityDate: toIso(inv.maturity_date),
            status: inv.status,
          }
        : null,
    };
  }

  /**
   * Admin: approve a pending request so the payout can be processed
   */
  public static async approveWithdrawal(
    withdrawalId: number,
    adminId: number,
    input: ApproveWithdrawalInput,
    meta: RequestMeta = {}
  ) {
    const withdrawal = await sequelize.transaction(async (t) => {
      const w = await Withdrawal.findByPk(withdrawalId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!w) {
        throw new NotFoundError('Withdrawal request not found');
      }
      if (w.status !== WithdrawalStatus.PENDING) {
        throw new BadRequestError(`Only pending requests can be approved. This request is ${w.status.toLowerCase()}.`);
      }

      if (input.profitAmount !== undefined) {
        if (!w.is_early) {
          throw new BadRequestError('Profit can only be overridden for early withdrawals.');
        }
        const inv = await Investment.findByPk(w.investment_id, { transaction: t });
        const profitPaise = toPaise(input.profitAmount);
        if (!inv || profitPaise > toPaise(inv.expected_profit)) {
          throw new BadRequestError(
            `Profit cannot exceed the plan's expected profit of ${formatInr(inv?.expected_profit ?? 0)}.`
          );
        }
        w.profit_amount = fromPaise(profitPaise);
        w.total_amount = fromPaise(toPaise(w.principal_amount) + profitPaise);
      }

      w.status = WithdrawalStatus.APPROVED;
      w.admin_remarks = input.remarks?.trim() || null;
      w.reviewed_by = adminId;
      w.reviewed_at = new Date();
      await w.save({ transaction: t });
      return w;
    });

    await ActivityLogService.log({
      userId: adminId,
      action: 'WITHDRAWAL_APPROVED',
      entity: 'WITHDRAWAL',
      entityId: withdrawal.id,
      description: `Admin #${adminId} approved withdrawal ${withdrawal.reference} (${formatInr(withdrawal.total_amount)}) for customer #${withdrawal.user_id}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: withdrawal.user_id,
      type: NotificationType.WITHDRAWAL_APPROVED,
      title: 'Withdrawal approved',
      message: `Your withdrawal ${withdrawal.reference} for ${formatInr(
        withdrawal.total_amount
      )} was approved and is being processed.`,
      relatedEntity: 'WITHDRAWAL',
      relatedId: withdrawal.id,
    });

    return serialize(withdrawal);
  }

  /**
   * Admin: reject a request. The investment returns to the state it was in.
   */
  public static async rejectWithdrawal(
    withdrawalId: number,
    adminId: number,
    reason: string,
    remarks?: string | null,
    meta: RequestMeta = {}
  ) {
    const withdrawal = await sequelize.transaction(async (t) => {
      const w = await Withdrawal.findByPk(withdrawalId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!w) {
        throw new NotFoundError('Withdrawal request not found');
      }
      if (![WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(w.status)) {
        throw new BadRequestError(`This request is already ${w.status.toLowerCase()} and cannot be rejected.`);
      }

      const inv = await Investment.findByPk(w.investment_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!inv) {
        throw new NotFoundError('Linked investment not found');
      }

      if (inv.status === InvestmentStatus.WITHDRAWAL_REQUESTED) {
        const maturityDate = parseDbDate(inv.maturity_date);
        const hasMatured = maturityDate !== null && maturityDate.getTime() <= Date.now();
        inv.status = hasMatured ? InvestmentStatus.MATURED : InvestmentStatus.ACTIVE;
        if (hasMatured && !inv.matured_at) {
          inv.matured_at = new Date();
        }
        await inv.save({ transaction: t });
      }

      w.status = WithdrawalStatus.REJECTED;
      w.rejection_reason = reason.trim();
      if (remarks !== undefined) w.admin_remarks = remarks?.trim() || null;
      w.reviewed_by = adminId;
      w.reviewed_at = new Date();
      await w.save({ transaction: t });
      return w;
    });

    await ActivityLogService.log({
      userId: adminId,
      action: 'WITHDRAWAL_REJECTED',
      entity: 'WITHDRAWAL',
      entityId: withdrawal.id,
      description: `Admin #${adminId} rejected withdrawal ${withdrawal.reference}. Reason: ${reason}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: withdrawal.user_id,
      type: NotificationType.WITHDRAWAL_REJECTED,
      title: 'Withdrawal request rejected',
      message: `Your withdrawal ${withdrawal.reference} was rejected. Reason: ${reason}. Your investment is unaffected and you can submit a new request.`,
      relatedEntity: 'WITHDRAWAL',
      relatedId: withdrawal.id,
    });

    return serialize(withdrawal);
  }

  /**
   * Admin: record the payout and close the investment. Principal and profit
   * are posted to the ledger and paid out in the same transaction.
   */
  public static async completeWithdrawal(
    withdrawalId: number,
    adminId: number,
    input: CompleteWithdrawalInput,
    proof: Express.Multer.File | undefined,
    meta: RequestMeta = {}
  ) {
    const existing = await Withdrawal.findByPk(withdrawalId);
    if (!existing) {
      throw new NotFoundError('Withdrawal request not found');
    }
    if (existing.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestError(
        `Only approved requests can be marked as completed. This request is ${existing.status.toLowerCase()}.`
      );
    }

    const duplicate = await Withdrawal.findOne({
      where: { payment_reference: input.paymentReference, id: { [Op.ne]: withdrawalId } },
    });
    if (duplicate) {
      throw new ConflictError(
        `Payment reference ${input.paymentReference} is already recorded against ${duplicate.reference}.`
      );
    }

    const proofFile = proof
      ? await FileService.savePaymentDocument(existing.user_id, proof, 'PAYOUT_PROOF')
      : null;

    const withdrawal = await sequelize.transaction(async (t) => {
      const w = await Withdrawal.findByPk(withdrawalId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!w) {
        throw new NotFoundError('Withdrawal request not found');
      }
      if (w.status !== WithdrawalStatus.APPROVED) {
        throw new BadRequestError(
          `Only approved requests can be marked as completed. This request is ${w.status.toLowerCase()}.`
        );
      }

      const inv = await Investment.findByPk(w.investment_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!inv) {
        throw new NotFoundError('Linked investment not found');
      }
      if (inv.status !== InvestmentStatus.WITHDRAWAL_REQUESTED) {
        throw new BadRequestError(
          `Investment ${inv.reference} is ${inv.status.replace(/_/g, ' ').toLowerCase()} and cannot be paid out.`
        );
      }

      const principalPaise = toPaise(w.principal_amount);
      const profitPaise = toPaise(w.profit_amount);

      await WalletService.applyEntry(
        {
          userId: w.user_id,
          type: WalletTxnType.MATURITY_PRINCIPAL,
          direction: WalletTxnDirection.CREDIT,
          amountPaise: principalPaise,
          description: `Principal returned for investment ${inv.reference}`,
          relatedEntity: 'INVESTMENT',
          relatedId: inv.id,
          createdBy: adminId,
        },
        t
      );

      if (profitPaise > 0) {
        await WalletService.applyEntry(
          {
            userId: w.user_id,
            type: WalletTxnType.PROFIT,
            direction: WalletTxnDirection.CREDIT,
            amountPaise: profitPaise,
            description: `Profit earned on investment ${inv.reference}`,
            relatedEntity: 'INVESTMENT',
            relatedId: inv.id,
            createdBy: adminId,
          },
          t
        );
      }

      await WalletService.applyEntry(
        {
          userId: w.user_id,
          type: WalletTxnType.WITHDRAWAL,
          direction: WalletTxnDirection.DEBIT,
          amountPaise: principalPaise + profitPaise,
          description: `Withdrawal ${w.reference} paid via ${w.payout_method} (Ref ${input.paymentReference})`,
          relatedEntity: 'WITHDRAWAL',
          relatedId: w.id,
          createdBy: adminId,
        },
        t
      );

      inv.status = InvestmentStatus.COMPLETED;
      inv.completed_at = new Date();
      inv.early_withdrawal_allowed = false;
      await inv.save({ transaction: t });

      w.status = WithdrawalStatus.COMPLETED;
      w.payment_reference = input.paymentReference;
      if (proofFile) w.payment_proof_file = proofFile.fileName;
      if (input.remarks) w.admin_remarks = input.remarks.trim();
      w.processed_by = adminId;
      w.completed_at = new Date();
      await w.save({ transaction: t });

      (w as any).investment = inv;
      return w;
    });

    await ActivityLogService.log({
      userId: adminId,
      action: 'WITHDRAWAL_COMPLETED',
      entity: 'WITHDRAWAL',
      entityId: withdrawal.id,
      description: `Admin #${adminId} completed withdrawal ${withdrawal.reference}: paid ${formatInr(
        withdrawal.total_amount
      )} to customer #${withdrawal.user_id} via ${withdrawal.payout_method} (Ref ${input.paymentReference})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: withdrawal.user_id,
      type: NotificationType.WITHDRAWAL_COMPLETED,
      title: 'Withdrawal completed',
      message: `${formatInr(withdrawal.total_amount)} for withdrawal ${withdrawal.reference} has been paid to your registered ${
        withdrawal.payout_method === PayoutMethod.UPI ? 'UPI ID' : 'bank account'
      }. Payment reference: ${input.paymentReference}.`,
      relatedEntity: 'WITHDRAWAL',
      relatedId: withdrawal.id,
    });

    return serialize(withdrawal);
  }

  /**
   * Resolves the payout proof for the owner or a staff member
   */
  public static async getProofFile(withdrawalId: number, requestingUser: JwtUserPayload) {
    const withdrawal = await Withdrawal.findByPk(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundError('Withdrawal request not found');
    }

    const isStaff = requestingUser.role !== UserRole.CUSTOMER;
    if (!isStaff && withdrawal.user_id !== requestingUser.id) {
      throw new ForbiddenError('You are not allowed to view this document');
    }

    if (!withdrawal.payment_proof_file) {
      throw new NotFoundError('No payment proof has been uploaded for this withdrawal');
    }

    return FileService.getSecureFile(withdrawal.payment_proof_file);
  }
}
