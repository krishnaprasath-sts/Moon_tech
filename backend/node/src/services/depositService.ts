import { Op } from 'sequelize';
import { sequelize, Deposit, User, CustomerProfile } from '../models/index.js';
import {
  DepositStatus,
  WalletTxnType,
  WalletTxnDirection,
  NotificationType,
  UserRole,
  UserStatus,
  JwtUserPayload,
} from '../types/index.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { toPaise, formatInr, generateReference } from '../utils/money.js';
import { toIso, parseDateRange } from '../utils/dates.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { SettingsService } from './settingsService.js';
import { WalletService } from './walletService.js';
import { FileService } from './fileService.js';
import { CreateDepositInput } from '../validators/financeValidators.js';

export interface DepositFilterParams {
  page?: unknown;
  limit?: unknown;
  status?: string;
  search?: string;
  userId?: unknown;
  startDate?: string;
  endDate?: string;
}

function serialize(deposit: Deposit) {
  return {
    id: deposit.id,
    reference: deposit.reference,
    userId: deposit.user_id,
    amount: deposit.amount,
    upiTransactionId: deposit.upi_transaction_id,
    hasReceipt: Boolean(deposit.receipt_file),
    status: deposit.status,
    rejectionReason: deposit.rejection_reason,
    adminRemarks: deposit.admin_remarks,
    reviewedAt: toIso(deposit.reviewed_at),
    createdAt: toIso(deposit.created_at),
  };
}

function serializeForAdmin(deposit: Deposit) {
  const u = (deposit as any).user;
  const reviewer = (deposit as any).reviewer;
  return {
    ...serialize(deposit),
    customerName: u?.profile?.full_name || 'N/A',
    customerEmail: u?.email || 'N/A',
    customerPhone: u?.phone || 'N/A',
    customerStatus: u?.status || null,
    reviewedBy: reviewer?.email || null,
  };
}

const adminIncludes = [
  {
    model: User,
    as: 'user',
    attributes: ['id', 'email', 'phone', 'status'],
    include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
  },
  { model: User, as: 'reviewer', attributes: ['id', 'email'] },
];

export class DepositService {
  /**
   * Customer: submit a UPI payment for verification. The wallet is NOT credited here.
   */
  public static async createDeposit(
    userId: number,
    input: CreateDepositInput,
    receipt: Express.Multer.File | undefined,
    meta: RequestMeta = {}
  ) {
    if (!receipt) {
      throw new BadRequestError('Payment receipt is required. Upload a screenshot or PDF of the UPI payment.');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User account not found');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenError('Only customer accounts can add money to a wallet.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Only active accounts can add money to a wallet.');
    }

    const settings = await SettingsService.getSettings();
    const amountPaise = toPaise(input.amount);

    if (amountPaise < toPaise(settings.walletMinTopup)) {
      throw new BadRequestError(`Minimum wallet top-up is ${formatInr(settings.walletMinTopup)}`);
    }
    if (amountPaise > toPaise(settings.walletMaxTopup)) {
      throw new BadRequestError(`Maximum wallet top-up is ${formatInr(settings.walletMaxTopup)}`);
    }

    const duplicate = await Deposit.findOne({
      where: {
        upi_transaction_id: input.upiTransactionId,
        status: { [Op.in]: [DepositStatus.PENDING, DepositStatus.APPROVED] },
      },
    });
    if (duplicate) {
      throw new ConflictError(
        `UPI transaction ID ${input.upiTransactionId} has already been submitted (${duplicate.reference}).`
      );
    }

    const saved = await FileService.savePaymentDocument(userId, receipt, 'DEPOSIT_RECEIPT');

    const deposit = await Deposit.create({
      reference: generateReference('DEP'),
      user_id: userId,
      amount: input.amount,
      upi_transaction_id: input.upiTransactionId,
      receipt_file: saved.fileName,
      status: DepositStatus.PENDING,
    });

    await ActivityLogService.log({
      userId,
      action: 'DEPOSIT_SUBMITTED',
      entity: 'DEPOSIT',
      entityId: deposit.id,
      description: `User #${userId} submitted UPI payment of ${formatInr(input.amount)} (${deposit.reference}, UTR ${input.upiTransactionId})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId,
      type: NotificationType.PAYMENT_SUBMITTED,
      title: 'Payment submitted for verification',
      message: `Your payment of ${formatInr(input.amount)} (${deposit.reference}) is awaiting verification. Your wallet will be credited once it is approved.`,
      relatedEntity: 'DEPOSIT',
      relatedId: deposit.id,
    });

    return serialize(deposit);
  }

  private static buildWhere(params: DepositFilterParams) {
    const where: any = {};

    if (params.status && Object.values(DepositStatus).includes(params.status as DepositStatus)) {
      where.status = params.status;
    }

    const { start, end } = parseDateRange(params.startDate, params.endDate);
    if (start && end) where.created_at = { [Op.between]: [start, end] };
    else if (start) where.created_at = { [Op.gte]: start };
    else if (end) where.created_at = { [Op.lte]: end };

    return where;
  }

  public static async listUserDeposits(userId: number, params: DepositFilterParams) {
    const { page, limit, offset } = getPagination(params, 10);
    const where = { ...this.buildWhere(params), user_id: userId };

    const { count, rows } = await Deposit.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return { deposits: rows.map(serialize), meta: buildMeta(page, limit, count) };
  }

  public static async adminListDeposits(params: DepositFilterParams) {
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
        { upi_transaction_id: { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
        { '$user.phone$': { [Op.like]: `%${search}%` } },
        { '$user.profile.full_name$': { [Op.like]: `%${search}%` } },
      ];
    }

    const [{ count, rows }, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Deposit.findAndCountAll({
        where,
        limit,
        offset,
        subQuery: false,
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
        include: adminIncludes,
      }),
      Deposit.count({ where: { status: DepositStatus.PENDING } }),
      Deposit.count({ where: { status: DepositStatus.APPROVED } }),
      Deposit.count({ where: { status: DepositStatus.REJECTED } }),
    ]);

    return {
      deposits: rows.map(serializeForAdmin),
      meta: {
        ...buildMeta(page, limit, count),
        counts: { pending: pendingCount, approved: approvedCount, rejected: rejectedCount },
      },
    };
  }

  public static async adminGetDeposit(depositId: number) {
    const deposit = await Deposit.findByPk(depositId, { include: adminIncludes });
    if (!deposit) {
      throw new NotFoundError('Payment submission not found');
    }

    const walletBalance = await WalletService.getBalance(deposit.user_id);
    return { ...serializeForAdmin(deposit), walletBalance };
  }

  /**
   * Admin: approve the payment and credit the wallet atomically
   */
  public static async approveDeposit(
    depositId: number,
    adminId: number,
    remarks?: string | null,
    meta: RequestMeta = {}
  ) {
    const result = await sequelize.transaction(async (t) => {
      const deposit = await Deposit.findByPk(depositId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!deposit) {
        throw new NotFoundError('Payment submission not found');
      }
      if (deposit.status !== DepositStatus.PENDING) {
        throw new BadRequestError(`This payment has already been ${deposit.status.toLowerCase()}.`);
      }

      const alreadyCredited = await Deposit.findOne({
        where: {
          upi_transaction_id: deposit.upi_transaction_id,
          status: DepositStatus.APPROVED,
          id: { [Op.ne]: deposit.id },
        },
        transaction: t,
      });
      if (alreadyCredited) {
        throw new ConflictError(
          `UPI transaction ID ${deposit.upi_transaction_id} was already credited under ${alreadyCredited.reference}.`
        );
      }

      const txn = await WalletService.applyEntry(
        {
          userId: deposit.user_id,
          type: WalletTxnType.DEPOSIT,
          direction: WalletTxnDirection.CREDIT,
          amountPaise: toPaise(deposit.amount),
          description: `Wallet top-up via UPI (${deposit.reference}, UTR ${deposit.upi_transaction_id})`,
          relatedEntity: 'DEPOSIT',
          relatedId: deposit.id,
          createdBy: adminId,
        },
        t
      );

      deposit.status = DepositStatus.APPROVED;
      deposit.admin_remarks = remarks?.trim() || null;
      deposit.reviewed_by = adminId;
      deposit.reviewed_at = new Date();
      await deposit.save({ transaction: t });

      return { deposit, txn };
    });

    const { deposit, txn } = result;

    await ActivityLogService.log({
      userId: adminId,
      action: 'DEPOSIT_APPROVED',
      entity: 'DEPOSIT',
      entityId: deposit.id,
      description: `Admin #${adminId} approved payment ${deposit.reference} and credited ${formatInr(
        deposit.amount
      )} to customer #${deposit.user_id} wallet (${txn.reference})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: deposit.user_id,
      type: NotificationType.PAYMENT_VERIFIED,
      title: 'Payment verified',
      message: `Your payment of ${formatInr(deposit.amount)} (${deposit.reference}) was verified and added to your wallet. New balance: ${formatInr(
        txn.balance_after
      )}.`,
      relatedEntity: 'DEPOSIT',
      relatedId: deposit.id,
    });

    return { ...serialize(deposit), walletBalance: txn.balance_after, transactionReference: txn.reference };
  }

  /**
   * Admin: reject the payment. The wallet is never touched.
   */
  public static async rejectDeposit(
    depositId: number,
    adminId: number,
    reason: string,
    remarks?: string | null,
    meta: RequestMeta = {}
  ) {
    const deposit = await sequelize.transaction(async (t) => {
      const row = await Deposit.findByPk(depositId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!row) {
        throw new NotFoundError('Payment submission not found');
      }
      if (row.status !== DepositStatus.PENDING) {
        throw new BadRequestError(`This payment has already been ${row.status.toLowerCase()}.`);
      }

      row.status = DepositStatus.REJECTED;
      row.rejection_reason = reason.trim();
      row.admin_remarks = remarks?.trim() || null;
      row.reviewed_by = adminId;
      row.reviewed_at = new Date();
      await row.save({ transaction: t });
      return row;
    });

    await ActivityLogService.log({
      userId: adminId,
      action: 'DEPOSIT_REJECTED',
      entity: 'DEPOSIT',
      entityId: deposit.id,
      description: `Admin #${adminId} rejected payment ${deposit.reference} (${formatInr(deposit.amount)}). Reason: ${reason}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: deposit.user_id,
      type: NotificationType.PAYMENT_REJECTED,
      title: 'Payment could not be verified',
      message: `Your payment of ${formatInr(deposit.amount)} (${deposit.reference}) was rejected. Reason: ${reason}`,
      relatedEntity: 'DEPOSIT',
      relatedId: deposit.id,
    });

    return serialize(deposit);
  }

  /**
   * Resolves the receipt file for the owner or a staff member
   */
  public static async getReceiptFile(depositId: number, requestingUser: JwtUserPayload) {
    const deposit = await Deposit.findByPk(depositId);
    if (!deposit) {
      throw new NotFoundError('Payment submission not found');
    }

    const isStaff = requestingUser.role !== UserRole.CUSTOMER;
    if (!isStaff && deposit.user_id !== requestingUser.id) {
      throw new ForbiddenError('You are not allowed to view this receipt');
    }

    return FileService.getSecureFile(deposit.receipt_file);
  }
}
