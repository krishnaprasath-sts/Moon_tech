import { Op } from 'sequelize';
import {
  sequelize,
  Withdrawal,
  Investment,
  User,
  CustomerProfile,
  UserPayoutDetail,
  KycProfile,
} from '../models/index.js';
import {
  WithdrawalStatus,
  WithdrawalSource,
  WalletBucket,
  InvestmentStatus,
  PayoutMethod,
  ProfitPayoutMode,
  WalletTxnType,
  WalletTxnDirection,
  NotificationType,
  UserRole,
  UserStatus,
  KycStatus,
  JwtUserPayload,
} from '../types/index.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise, formatInr, generateReference } from '../utils/money.js';
import { decryptData } from '../utils/encryption.js';
import { BankAccountService, encryptedFingerprint } from './bankAccountService.js';
import { maskBankAccount } from '../utils/mask.js';
import { toIso, parseDbDate, parseDateRange } from '../utils/dates.js';
import { latestPayableDay } from '../utils/workingDays.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { WalletService, BUCKET_LABELS } from './walletService.js';
import { FileService } from './fileService.js';
import { SettingsService } from './settingsService.js';
import { capitalWithdrawalBreakdown, lockState } from './investmentService.js';
import { DailyPayoutService } from './dailyPayoutService.js';
import {
  RequestWithdrawalInput,
  WalletWithdrawalInput,
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
    source: w.source,
    bucket: w.bucket,
    investmentId: w.investment_id,
    investmentReference: inv?.reference || null,
    planName: inv?.plan_name || null,
    principalAmount: w.principal_amount,
    profitAmount: w.profit_amount,
    // Gross requested; the customer is paid netAmount = totalAmount - feeAmount
    totalAmount: w.total_amount,
    feePercent: w.fee_percent,
    feeAmount: w.fee_amount,
    netAmount: w.net_amount,
    isEarly: Boolean(w.is_early),
    payoutMethod: w.payout_method,
    payoutUpiId: w.payout_upi_id,
    payoutAccountHolder: w.payout_account_holder,
    payoutAccountMasked: w.payout_account_last4 ? maskBankAccount(`XXXXXXXX${w.payout_account_last4}`) : null,
    payoutIfsc: w.payout_ifsc,
    payoutBankName: w.payout_bank_name,
    payoutBankBranch: w.payout_bank_branch,
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
   * Shared eligibility checks for any payout request: account state, KYC (when the
   * admin requires it) and complete payout details for the chosen method.
   */
  private static async preparePayout(userId: number, requestedMethod?: PayoutMethod) {
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

    const settings = await SettingsService.getSettings();
    if (settings.requireKycForWithdrawal) {
      const kyc = await KycProfile.findOne({ where: { user_id: userId } });
      if (!kyc || kyc.kyc_status !== KycStatus.VERIFIED) {
        throw new ForbiddenError('KYC verification is required before you can withdraw money.');
      }
    }

    const payout = await UserPayoutDetail.findOne({ where: { user_id: userId } });
    if (!payout) {
      throw new BadRequestError('Add your bank account details in your profile before requesting a withdrawal.');
    }

    if (requestedMethod === PayoutMethod.UPI) {
      throw new BadRequestError('Withdrawals are paid to your bank account only.');
    }
    // Bank account is the only payout destination
    const method = PayoutMethod.BANK;
    if (
      method === PayoutMethod.BANK &&
      (!payout.account_number_encrypted || !payout.ifsc_code || !payout.account_holder_name)
    ) {
      throw new BadRequestError('Bank details are incomplete. Update your payout details first.');
    }

    return { user, settings, payout, method };
  }

  /** Payout destination snapshot stored on the withdrawal so later profile edits do not change it */
  private static payoutSnapshot(payout: UserPayoutDetail, method: PayoutMethod) {
    return {
      payout_method: method,
      payout_upi_id: method === PayoutMethod.UPI ? payout.upi_id : null,
      payout_account_holder: method === PayoutMethod.BANK ? payout.account_holder_name : null,
      payout_account_number_encrypted: method === PayoutMethod.BANK ? payout.account_number_encrypted : null,
      payout_account_last4: method === PayoutMethod.BANK ? payout.account_last4 : null,
      payout_ifsc: method === PayoutMethod.BANK ? payout.ifsc_code : null,
      payout_bank_name: method === PayoutMethod.BANK ? payout.bank_name : null,
      payout_bank_branch: method === PayoutMethod.BANK ? payout.bank_branch : null,
      // Fingerprint + origin of the account, so the admin can tell a KYC account from a changed one
      payout_account_hash:
        method === PayoutMethod.BANK ? payout.account_hash || encryptedFingerprint(payout.account_number_encrypted) : null,
      payout_bank_source: method === PayoutMethod.BANK ? payout.bank_source || null : null,
    };
  }

  /**
   * Fee and net of a payout. Only the capital of an investment closed before it finishes
   * (`early`) pays the fee, on the principal only and never on profit paid along with it.
   * Profit withdrawals, matured capital and the capital wallet are paid in full.
   */
  private static feeBreakdown(
    bucket: WalletBucket,
    principalPaise: number,
    feePercent: number,
    profitPaise = 0,
    early = false
  ) {
    const effectivePercent = bucket === WalletBucket.CAPITAL && early ? feePercent : 0;
    const { feePaise, netPaise } = capitalWithdrawalBreakdown(principalPaise, profitPaise, effectivePercent);
    return {
      fee_percent: effectivePercent,
      fee_amount: fromPaise(feePaise),
      net_amount: fromPaise(netPaise),
    };
  }

  /**
   * Customer: withdraw from the wallet.
   * PROFIT bucket: any amount (above the minimum) of daily profit / referral commission, no fee.
   * CAPITAL bucket: the whole available capital balance, any time, no fee (the money is not in
   * a running plan; only closing an investment early carries the fee).
   * The amount is debited immediately so it cannot be invested or withdrawn twice while the
   * admin reviews the request; a rejection refunds it.
   */
  public static async requestWalletWithdrawal(userId: number, input: WalletWithdrawalInput, meta: RequestMeta = {}) {
    const { settings, payout, method } = await this.preparePayout(userId, input.payoutMethod);
    const bucket = input.bucket;

    const withdrawal = await sequelize.transaction(async (t) => {
      let amountPaise: number;
      if (bucket === WalletBucket.CAPITAL) {
        // Capital is withdrawn in full
        const wallet = await WalletService.getLockedWallet(userId, t);
        amountPaise = toPaise(wallet.capital_balance);
        if (amountPaise <= 0) {
          throw new BadRequestError('There is no capital in your wallet to withdraw.');
        }
      } else {
        amountPaise = toPaise(input.amount);
        if (amountPaise < toPaise(settings.walletMinWithdrawal)) {
          throw new BadRequestError(`The minimum withdrawal is ${formatInr(settings.walletMinWithdrawal)}.`);
        }
      }

      const created = await Withdrawal.create(
        {
          reference: generateReference('WDR'),
          user_id: userId,
          source: WithdrawalSource.WALLET,
          bucket,
          investment_id: null,
          principal_amount: fromPaise(amountPaise),
          profit_amount: 0,
          total_amount: fromPaise(amountPaise),
          // Wallet money is never "early": no fee on either bucket
          ...this.feeBreakdown(bucket, amountPaise, settings.capitalWithdrawalFeePercent, 0, false),
          is_early: false,
          ...this.payoutSnapshot(payout, method),
          status: WithdrawalStatus.PENDING,
        },
        { transaction: t }
      );

      // Throws "Insufficient ... balance" when the customer asks for more than they hold
      await WalletService.applyEntry(
        {
          userId,
          type: WalletTxnType.WITHDRAWAL,
          direction: WalletTxnDirection.DEBIT,
          bucket,
          amountPaise,
          description: `${bucket === WalletBucket.CAPITAL ? 'Capital' : 'Profit'} withdrawal ${created.reference} requested (on hold until paid)`,
          relatedEntity: 'WITHDRAWAL',
          relatedId: created.id,
        },
        t
      );

      return created;
    });

    await ActivityLogService.log({
      userId,
      action: 'WITHDRAWAL_REQUESTED',
      entity: 'WITHDRAWAL',
      entityId: withdrawal.id,
      description: `User #${userId} requested ${BUCKET_LABELS[bucket]} withdrawal ${withdrawal.reference} of ${formatInr(
        withdrawal.total_amount
      )} (fee ${formatInr(withdrawal.fee_amount)}, net ${formatInr(withdrawal.net_amount)}) via ${method}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId,
      type: NotificationType.WITHDRAWAL_REQUESTED,
      title: 'Withdrawal request received',
      message: `Your ${BUCKET_LABELS[bucket]} withdrawal ${withdrawal.reference} for ${formatInr(
        withdrawal.total_amount
      )} has been received.${
        toPaise(withdrawal.fee_amount) > 0
          ? ` After the ${withdrawal.fee_percent}% early withdrawal fee of ${formatInr(withdrawal.fee_amount)}, ${formatInr(
              withdrawal.net_amount
            )} will be paid`
          : ' It will be paid'
      } to your ${method === PayoutMethod.UPI ? 'UPI ID' : 'bank account'} after admin verification. The amount is reserved from your wallet meanwhile.`,
      relatedEntity: 'WITHDRAWAL',
      relatedId: withdrawal.id,
    });

    return serialize(withdrawal);
  }

  /**
   * Customer: close an investment and withdraw its capital, at any time. Closing it before it
   * finishes (early exit; open-ended plans never finish) deducts the capital withdrawal fee;
   * after maturity the capital is paid in full. The daily profit already sits in the profit wallet.
   */
  public static async requestWithdrawal(
    userId: number,
    investmentId: number,
    input: RequestWithdrawalInput,
    meta: RequestMeta = {}
  ) {
    const { payout, method } = await this.preparePayout(userId, input.payoutMethod);

    const withdrawal = await sequelize.transaction(async (t) => {
      const inv = await Investment.findOne({
        where: { id: investmentId, user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!inv) {
        throw new NotFoundError('Investment not found');
      }

      if (inv.status === InvestmentStatus.WITHDRAWAL_REQUESTED) {
        throw new ConflictError('A withdrawal request already exists for this investment.');
      }
      if (inv.status === InvestmentStatus.COMPLETED || inv.status === InvestmentStatus.CANCELLED) {
        throw new BadRequestError(`This investment is already ${inv.status.toLowerCase()}.`);
      }

      const { lockInEndsAt, isLocked } = lockState(inv);
      if (isLocked) {
        throw new ForbiddenError(
          `The capital of this investment is locked until ${lockInEndsAt?.toDateString() ?? 'the end of its lock-in period'}.`
        );
      }

      const maturityDate = parseDbDate(inv.maturity_date);
      const hasMatured =
        inv.status === InvestmentStatus.MATURED ||
        (maturityDate !== null && maturityDate.getTime() <= Date.now());
      // Open-ended plans never "mature"; closing them early is the normal way out
      const isEarly = !hasMatured;
      const principalPaise = toPaise(inv.amount);

      // Daily and monthly plans have already credited their profit periodically to the profit wallet;
      // maturity-paid plans only earn their profit by completing the full period.
      const profitPaise =
        isEarly || inv.payout_mode === ProfitPayoutMode.DAILY || inv.payout_mode === ProfitPayoutMode.MONTHLY
          ? 0
          : toPaise(inv.expected_profit);
      const grossPaise = principalPaise + profitPaise;

      const created = await Withdrawal.create(
        {
          reference: generateReference('WDR'),
          user_id: userId,
          source: WithdrawalSource.INVESTMENT,
          bucket: WalletBucket.CAPITAL,
          investment_id: inv.id,
          principal_amount: fromPaise(principalPaise),
          profit_amount: fromPaise(profitPaise),
          total_amount: fromPaise(grossPaise),
          ...this.feeBreakdown(WalletBucket.CAPITAL, principalPaise, Number(inv.fee_percent) || 0, profitPaise, isEarly),
          is_early: isEarly,
          ...this.payoutSnapshot(payout, method),
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
      description: `User #${userId} requested capital withdrawal ${withdrawal.reference} of ${formatInr(
        withdrawal.total_amount
      )} (fee ${formatInr(withdrawal.fee_amount)}, net ${formatInr(withdrawal.net_amount)}) for investment #${
        withdrawal.investment_id
      }${withdrawal.is_early ? ' (before maturity)' : ''}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId,
      type: NotificationType.WITHDRAWAL_REQUESTED,
      title: 'Withdrawal request received',
      message: `Your capital withdrawal ${withdrawal.reference} for ${formatInr(
        withdrawal.total_amount
      )} has been received and is awaiting review. ${
        toPaise(withdrawal.fee_amount) > 0
          ? `After the ${withdrawal.fee_percent}% early withdrawal fee of ${formatInr(withdrawal.fee_amount)}, ${formatInr(
              withdrawal.net_amount
            )} will be paid to you.`
          : `${formatInr(withdrawal.net_amount)} will be paid to you in full.`
      } Daily profit on this investment stops now.`,
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

    const bankFlags = await BankAccountService.bankFlagsForWithdrawals(rows);
    return {
      withdrawals: rows.map((w) => ({ ...serializeForAdmin(w), bankFlag: bankFlags.get(w.id) ?? null })),
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
      // KYC account / approved change / unverified, with the reasons
      bankCheck: await BankAccountService.bankCheckForWithdrawal(withdrawal),
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
        if (!w.is_early || w.source !== WithdrawalSource.INVESTMENT || !w.investment_id) {
          throw new BadRequestError('Profit can only be overridden for early investment withdrawals.');
        }
        const inv = await Investment.findByPk(w.investment_id, { transaction: t });
        const profitPaise = toPaise(input.profitAmount);
        if (!inv || profitPaise > toPaise(inv.expected_profit)) {
          throw new BadRequestError(
            `Profit cannot exceed the plan's expected profit of ${formatInr(inv?.expected_profit ?? 0)}.`
          );
        }
        const money = capitalWithdrawalBreakdown(toPaise(w.principal_amount), profitPaise, Number(w.fee_percent) || 0);
        w.profit_amount = fromPaise(money.profitPaise);
        w.total_amount = fromPaise(money.grossPaise);
        w.fee_amount = fromPaise(money.feePaise);
        w.net_amount = fromPaise(money.netPaise);
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
      description: `Admin #${adminId} approved withdrawal ${withdrawal.reference} (${formatInr(
        withdrawal.total_amount
      )} gross, ${formatInr(withdrawal.net_amount)} payable) for customer #${withdrawal.user_id}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: withdrawal.user_id,
      type: NotificationType.WITHDRAWAL_APPROVED,
      title: 'Withdrawal approved',
      message: `Your withdrawal ${withdrawal.reference} was approved. ${formatInr(
        withdrawal.net_amount
      )} is being processed for payment.`,
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

      if (w.source === WithdrawalSource.WALLET) {
        // The amount was reserved when the request was made; give it back to the same bucket
        await WalletService.applyEntry(
          {
            userId: w.user_id,
            type: WalletTxnType.REFUND,
            direction: WalletTxnDirection.CREDIT,
            bucket: w.bucket,
            amountPaise: toPaise(w.total_amount),
            description: `Refund of rejected ${BUCKET_LABELS[w.bucket]} withdrawal ${w.reference}`,
            relatedEntity: 'WITHDRAWAL',
            relatedId: w.id,
            createdBy: adminId,
          },
          t
        );
      } else {
        const inv = w.investment_id
          ? await Investment.findByPk(w.investment_id, { transaction: t, lock: t.LOCK.UPDATE })
          : null;
        if (!inv) {
          throw new NotFoundError('Linked investment not found');
        }

        if (inv.status === InvestmentStatus.WITHDRAWAL_REQUESTED) {
          // Back to ACTIVE: it keeps earning daily profit (a matured one is settled by the maturity job)
          inv.status = InvestmentStatus.ACTIVE;
          inv.matured_at = null;
          await inv.save({ transaction: t });
        }
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
      message:
        withdrawal.source === WithdrawalSource.WALLET
          ? `Your withdrawal ${withdrawal.reference} was rejected. Reason: ${reason}. ${formatInr(
              withdrawal.total_amount
            )} has been returned to your ${BUCKET_LABELS[withdrawal.bucket]}.`
          : `Your withdrawal ${withdrawal.reference} was rejected. Reason: ${reason}. Your investment stays active and keeps earning; you can submit a new request.`,
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

    // Daily/monthly-profit investments: credit every period earned up to the withdrawal request
    // before the investment is closed, so a payout completed before the 06:00 run never loses a day.
    // The referrer's daily commission for those days is settled the same way.
    if (existing.source === WithdrawalSource.INVESTMENT && existing.investment_id) {
      const inv = await Investment.findByPk(existing.investment_id);
      if (inv) {
        const lastDay = await DailyPayoutService.lastEarningDay(inv, latestPayableDay(new Date()));
        if (inv.payout_mode === ProfitPayoutMode.DAILY || inv.payout_mode === ProfitPayoutMode.MONTHLY) {
          await DailyPayoutService.creditInvestmentUpTo(inv, lastDay);
        }
        await DailyPayoutService.creditReferralCommissionUpTo(inv, lastDay, { notify: true });
      }
    }

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

      if (w.source === WithdrawalSource.WALLET) {
        // The wallet was already debited when the request was made; just record the payout
        w.status = WithdrawalStatus.COMPLETED;
        w.payment_reference = input.paymentReference;
        if (proofFile) w.payment_proof_file = proofFile.fileName;
        if (input.remarks) w.admin_remarks = input.remarks.trim();
        w.processed_by = adminId;
        w.completed_at = new Date();
        await w.save({ transaction: t });
        return w;
      }

      const inv = w.investment_id
        ? await Investment.findByPk(w.investment_id, { transaction: t, lock: t.LOCK.UPDATE })
        : null;
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

      // The capital passes through the capital wallet so the ledger shows it in and out
      await WalletService.applyEntry(
        {
          userId: w.user_id,
          type: WalletTxnType.MATURITY_PRINCIPAL,
          direction: WalletTxnDirection.CREDIT,
          bucket: WalletBucket.CAPITAL,
          amountPaise: principalPaise,
          description: `Capital released from investment ${inv.reference}`,
          relatedEntity: 'INVESTMENT',
          relatedId: inv.id,
          createdBy: adminId,
        },
        t
      );
      await WalletService.applyEntry(
        {
          userId: w.user_id,
          type: WalletTxnType.WITHDRAWAL,
          direction: WalletTxnDirection.DEBIT,
          bucket: WalletBucket.CAPITAL,
          amountPaise: principalPaise,
          description: `Capital withdrawal ${w.reference} paid via ${w.payout_method} (Ref ${input.paymentReference}); ${formatInr(
            w.fee_amount
          )} fee deducted, ${formatInr(w.net_amount)} paid`,
          relatedEntity: 'WITHDRAWAL',
          relatedId: w.id,
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
            bucket: WalletBucket.PROFIT,
            amountPaise: profitPaise,
            description: `Profit earned on investment ${inv.reference}`,
            relatedEntity: 'INVESTMENT',
            relatedId: inv.id,
            createdBy: adminId,
          },
          t
        );
        await WalletService.applyEntry(
          {
            userId: w.user_id,
            type: WalletTxnType.WITHDRAWAL,
            direction: WalletTxnDirection.DEBIT,
            bucket: WalletBucket.PROFIT,
            amountPaise: profitPaise,
            description: `Profit paid with withdrawal ${w.reference} (Ref ${input.paymentReference})`,
            relatedEntity: 'WITHDRAWAL',
            relatedId: w.id,
            createdBy: adminId,
          },
          t
        );
      }

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
        withdrawal.net_amount
      )} (${formatInr(withdrawal.total_amount)} less ${formatInr(withdrawal.fee_amount)} fee) to customer #${
        withdrawal.user_id
      } via ${withdrawal.payout_method} (Ref ${input.paymentReference})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: withdrawal.user_id,
      type: NotificationType.WITHDRAWAL_COMPLETED,
      title: 'Withdrawal completed',
      message: `${formatInr(withdrawal.net_amount)} for withdrawal ${withdrawal.reference} has been paid to your registered ${
        withdrawal.payout_method === PayoutMethod.UPI ? 'UPI ID' : 'bank account'
      }${
        toPaise(withdrawal.fee_amount) > 0
          ? ` (${formatInr(withdrawal.total_amount)} less the ${withdrawal.fee_percent}% capital withdrawal fee of ${formatInr(
              withdrawal.fee_amount
            )})`
          : ''
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
