import { Op, Transaction } from 'sequelize';
import {
  sequelize,
  Wallet,
  WalletTransaction,
  Deposit,
  Investment,
  Withdrawal,
  User,
  CustomerProfile,
  ProfitCredit,
  ReferralCommission,
  ReferralDailyCredit,
} from '../models/index.js';
import {
  WalletTxnType,
  WalletTxnDirection,
  WalletBucket,
  DepositStatus,
  InvestmentStatus,
  WithdrawalStatus,
  WithdrawalSource,
  NotificationType,
  UserRole,
  ReferralCommissionStatus,
} from '../types/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise, formatInr, generateReference } from '../utils/money.js';
import { toIso, parseDateRange } from '../utils/dates.js';
import { istDayKey } from '../utils/workingDays.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { WalletAdjustmentInput } from '../validators/financeValidators.js';

export interface LedgerEntryParams {
  userId: number;
  type: WalletTxnType;
  direction: WalletTxnDirection;
  /** Which balance the entry moves */
  bucket: WalletBucket;
  amountPaise: number;
  description: string;
  relatedEntity?: string;
  relatedId?: number;
  createdBy?: number | null;
}

export interface TransactionFilterParams {
  page?: unknown;
  limit?: unknown;
  type?: string;
  direction?: string;
  bucket?: string;
  userId?: unknown;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface WalletBalances {
  /** capital + profit */
  balance: number;
  capitalBalance: number;
  profitBalance: number;
}

export const BUCKET_LABELS: Record<WalletBucket, string> = {
  [WalletBucket.CAPITAL]: 'capital wallet',
  [WalletBucket.PROFIT]: 'profit wallet',
};

export function serializeTransaction(txn: WalletTransaction) {
  return {
    id: txn.id,
    reference: txn.reference,
    type: txn.type,
    direction: txn.direction,
    bucket: txn.bucket,
    amount: txn.amount,
    balanceBefore: txn.balance_before,
    balanceAfter: txn.balance_after,
    relatedEntity: txn.related_entity,
    relatedId: txn.related_id,
    description: txn.description,
    status: 'COMPLETED',
    createdAt: toIso(txn.created_at),
  };
}

export class WalletService {
  /**
   * Returns the user's wallet row locked FOR UPDATE, creating it on first use.
   * Must be called inside a transaction.
   */
  public static async getLockedWallet(userId: number, t: Transaction): Promise<Wallet> {
    let wallet = await Wallet.findOne({
      where: { user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wallet) {
      await Wallet.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, balance: 0, capital_balance: 0, profit_balance: 0 },
        transaction: t,
      });
      wallet = await Wallet.findOne({
        where: { user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    }

    if (!wallet) {
      throw new NotFoundError('Wallet could not be initialised');
    }

    return wallet;
  }

  /**
   * Applies a single credit/debit to one wallet bucket and writes the ledger row.
   * The only code path allowed to change a wallet balance. `balance_before/after`
   * on the ledger row are the balances of the bucket that moved.
   */
  public static async applyEntry(params: LedgerEntryParams, t: Transaction): Promise<WalletTransaction> {
    if (!Number.isInteger(params.amountPaise) || params.amountPaise <= 0) {
      throw new BadRequestError('Transaction amount must be greater than 0');
    }
    if (!Object.values(WalletBucket).includes(params.bucket)) {
      throw new BadRequestError('Unknown wallet bucket');
    }

    const wallet = await this.getLockedWallet(params.userId, t);
    const field = params.bucket === WalletBucket.CAPITAL ? 'capital_balance' : 'profit_balance';
    const beforePaise = toPaise(wallet[field]);
    const afterPaise =
      params.direction === WalletTxnDirection.CREDIT
        ? beforePaise + params.amountPaise
        : beforePaise - params.amountPaise;

    if (afterPaise < 0) {
      throw new BadRequestError(
        `Insufficient ${BUCKET_LABELS[params.bucket]} balance. Available: ${formatInr(
          fromPaise(beforePaise)
        )}, required: ${formatInr(fromPaise(params.amountPaise))}`
      );
    }

    wallet[field] = fromPaise(afterPaise);
    wallet.balance = fromPaise(toPaise(wallet.capital_balance) + toPaise(wallet.profit_balance));
    await wallet.save({ transaction: t });

    return WalletTransaction.create(
      {
        reference: generateReference('TXN'),
        user_id: params.userId,
        wallet_id: wallet.id,
        type: params.type,
        direction: params.direction,
        bucket: params.bucket,
        amount: fromPaise(params.amountPaise),
        balance_before: fromPaise(beforePaise),
        balance_after: fromPaise(afterPaise),
        related_entity: params.relatedEntity ?? null,
        related_id: params.relatedId ?? null,
        description: params.description,
        created_by: params.createdBy ?? null,
      },
      { transaction: t }
    );
  }

  /** Total balance (capital + profit) */
  public static async getBalance(userId: number): Promise<number> {
    return (await this.getBalances(userId)).balance;
  }

  public static async getBalances(userId: number): Promise<WalletBalances> {
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) return { balance: 0, capitalBalance: 0, profitBalance: 0 };
    return {
      balance: fromPaise(toPaise(wallet.capital_balance) + toPaise(wallet.profit_balance)),
      capitalBalance: wallet.capital_balance,
      profitBalance: wallet.profit_balance,
    };
  }

  /**
   * Wallet + portfolio summary for a customer
   */
  public static async getSummary(userId: number) {
    const [
      balances,
      pendingDeposits,
      deposits,
      investments,
      withdrawals,
      profitCredits,
      commissions,
      dailyReferralCredits,
      profitLedger,
    ] = await Promise.all([
      this.getBalances(userId),
      Deposit.findAll({
        where: { user_id: userId, status: DepositStatus.PENDING },
        attributes: ['amount'],
      }),
      Deposit.findAll({
        where: { user_id: userId, status: DepositStatus.APPROVED },
        attributes: ['amount'],
      }),
      Investment.findAll({
        where: { user_id: userId },
        attributes: ['amount', 'expected_profit', 'profit_credited', 'status'],
      }),
      Withdrawal.findAll({
        where: { user_id: userId },
        attributes: ['total_amount', 'profit_amount', 'fee_amount', 'net_amount', 'status', 'source', 'bucket'],
      }),
      ProfitCredit.findAll({ where: { user_id: userId }, attributes: ['amount', 'credit_day'] }),
      ReferralCommission.findAll({ where: { referrer_user_id: userId }, attributes: ['amount', 'status'] }),
      ReferralDailyCredit.findAll({ where: { referrer_user_id: userId }, attributes: ['amount'] }),
      // Every profit credit that reached the wallet: daily credits and profit paid at maturity
      WalletTransaction.findAll({
        where: { user_id: userId, type: WalletTxnType.PROFIT, direction: WalletTxnDirection.CREDIT },
        attributes: ['amount'],
      }),
    ]);

    const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

    const locked = investments.filter((i) =>
      [InvestmentStatus.ACTIVE, InvestmentStatus.MATURED, InvestmentStatus.WITHDRAWAL_REQUESTED].includes(i.status)
    );
    const completedWithdrawals = withdrawals.filter((w) => w.status === WithdrawalStatus.COMPLETED);
    const openWithdrawals = withdrawals.filter((w) =>
      [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(w.status)
    );
    const dailyProfitPaise = sum(profitCredits.map((c) => toPaise(c.amount)));
    const latestCreditDay = profitCredits.map((c) => String(c.credit_day)).sort().pop() ?? null;
    const creditedCommissions = commissions.filter((c) => c.status === ReferralCommissionStatus.CREDITED);
    const pendingCommissions = commissions.filter((c) => c.status === ReferralCommissionStatus.PENDING);
    const dailyReferralPaise = sum(dailyReferralCredits.map((c: any) => toPaise(c.amount)));

    const todayKey = istDayKey(new Date());
    const monthPrefix = todayKey.slice(0, 7);
    const heldWallet = openWithdrawals.filter((w) => w.source === WithdrawalSource.WALLET);

    return {
      ...balances,
      // Capital locked in running investments; it earns the daily profit
      investedCapital: fromPaise(sum(locked.map((i) => toPaise(i.amount)))),
      pendingDepositAmount: fromPaise(sum(pendingDeposits.map((d) => toPaise(d.amount)))),
      pendingDepositCount: pendingDeposits.length,
      totalDeposited: fromPaise(sum(deposits.map((d) => toPaise(d.amount)))),
      investedAmount: fromPaise(sum(locked.map((i) => toPaise(i.amount)))),
      expectedProfit: fromPaise(sum(locked.map((i) => toPaise(i.expected_profit)))),
      // Profit that has reached the wallet: daily credits + profit paid at maturity (PROFIT ledger credits)
      totalProfitEarned: fromPaise(sum(profitLedger.map((t) => toPaise(t.amount)))),
      dailyProfitCredited: fromPaise(dailyProfitPaise),
      profitCreditedToday: fromPaise(
        sum(profitCredits.filter((c) => String(c.credit_day) === todayKey).map((c) => toPaise(c.amount)))
      ),
      profitCreditedThisMonth: fromPaise(
        sum(profitCredits.filter((c) => String(c.credit_day).startsWith(monthPrefix)).map((c) => toPaise(c.amount)))
      ),
      lastProfitCreditDay: latestCreditDay,
      referralEarnings: fromPaise(sum(creditedCommissions.map((c) => toPaise(c.amount))) + dailyReferralPaise),
      referralEarningsPending: fromPaise(sum(pendingCommissions.map((c) => toPaise(c.amount)))),
      totalWithdrawn: fromPaise(sum(completedWithdrawals.map((w) => toPaise(w.net_amount)))),
      totalFeesPaid: fromPaise(sum(completedWithdrawals.map((w) => toPaise(w.fee_amount)))),
      activeInvestments: investments.filter((i) => i.status === InvestmentStatus.ACTIVE).length,
      maturedInvestments: investments.filter((i) => i.status === InvestmentStatus.MATURED).length,
      pendingWithdrawals: openWithdrawals.length,
      // Wallet money reserved by withdrawal requests that are still being processed
      pendingWithdrawalAmount: fromPaise(sum(heldWallet.map((w) => toPaise(w.total_amount)))),
      pendingCapitalWithdrawalAmount: fromPaise(
        sum(heldWallet.filter((w) => w.bucket === WalletBucket.CAPITAL).map((w) => toPaise(w.total_amount)))
      ),
      pendingProfitWithdrawalAmount: fromPaise(
        sum(heldWallet.filter((w) => w.bucket === WalletBucket.PROFIT).map((w) => toPaise(w.total_amount)))
      ),
    };
  }

  private static buildTransactionWhere(params: TransactionFilterParams) {
    const where: any = {};

    if (params.type && Object.values(WalletTxnType).includes(params.type as WalletTxnType)) {
      where.type = params.type;
    }

    if (params.direction && Object.values(WalletTxnDirection).includes(params.direction as WalletTxnDirection)) {
      where.direction = params.direction;
    }

    if (params.bucket && Object.values(WalletBucket).includes(params.bucket as WalletBucket)) {
      where.bucket = params.bucket;
    }

    const { start, end } = parseDateRange(params.startDate, params.endDate);
    if (start && end) where.created_at = { [Op.between]: [start, end] };
    else if (start) where.created_at = { [Op.gte]: start };
    else if (end) where.created_at = { [Op.lte]: end };

    return where;
  }

  /**
   * Customer: own transaction history
   */
  public static async listUserTransactions(userId: number, params: TransactionFilterParams) {
    const { page, limit, offset } = getPagination(params, 20);
    const where = { ...this.buildTransactionWhere(params), user_id: userId };

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return {
      transactions: rows.map(serializeTransaction),
      meta: buildMeta(page, limit, count),
    };
  }

  /**
   * Admin: platform-wide wallet ledger
   */
  public static async adminListTransactions(params: TransactionFilterParams) {
    const { page, limit, offset } = getPagination(params, 20);
    const where = this.buildTransactionWhere(params);

    const userId = Number(params.userId);
    if (Number.isInteger(userId) && userId > 0) {
      where.user_id = userId;
    }

    const search = params.search?.trim();
    if (search) {
      where[Op.or] = [
        { reference: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
        { '$user.phone$': { [Op.like]: `%${search}%` } },
        { '$user.profile.full_name$': { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      limit,
      offset,
      subQuery: false,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'phone'],
          include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
        },
      ],
    });

    return {
      transactions: rows.map((txn) => {
        const u = (txn as any).user;
        return {
          ...serializeTransaction(txn),
          userId: txn.user_id,
          customerName: u?.profile?.full_name || 'N/A',
          customerEmail: u?.email || 'N/A',
          customerPhone: u?.phone || 'N/A',
        };
      }),
      meta: buildMeta(page, limit, count),
    };
  }

  /**
   * Admin: manual wallet credit/debit (refunds & corrections)
   */
  public static async adjustWallet(
    userId: number,
    input: WalletAdjustmentInput,
    adminId: number,
    meta: RequestMeta = {}
  ) {
    const user = await User.findOne({ where: { id: userId, role: UserRole.CUSTOMER } });
    if (!user) {
      throw new NotFoundError('Customer not found');
    }

    const amountPaise = toPaise(input.amount);

    const txn = await sequelize.transaction(async (t) =>
      this.applyEntry(
        {
          userId,
          type: WalletTxnType.ADJUSTMENT,
          direction: input.direction,
          bucket: input.bucket,
          amountPaise,
          description: `Admin adjustment (${BUCKET_LABELS[input.bucket]}): ${input.reason}`,
          relatedEntity: 'ADJUSTMENT',
          createdBy: adminId,
        },
        t
      )
    );

    await ActivityLogService.log({
      userId: adminId,
      action: 'WALLET_ADJUSTED',
      entity: 'WALLET',
      entityId: txn.wallet_id,
      description: `Admin #${adminId} ${input.direction === WalletTxnDirection.CREDIT ? 'credited' : 'debited'} ${formatInr(
        input.amount
      )} ${input.direction === WalletTxnDirection.CREDIT ? 'to' : 'from'} customer #${userId} ${BUCKET_LABELS[input.bucket]} (${
        txn.reference
      }). Reason: ${input.reason}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId,
      type: NotificationType.WALLET_ADJUSTMENT,
      title: input.direction === WalletTxnDirection.CREDIT ? 'Wallet credited' : 'Wallet debited',
      message: `${formatInr(input.amount)} was ${
        input.direction === WalletTxnDirection.CREDIT ? 'credited to' : 'debited from'
      } your ${BUCKET_LABELS[input.bucket]}. Reason: ${input.reason}. Reference: ${txn.reference}.`,
      relatedEntity: 'WALLET_TRANSACTION',
      relatedId: txn.id,
    });

    return serializeTransaction(txn);
  }
}
