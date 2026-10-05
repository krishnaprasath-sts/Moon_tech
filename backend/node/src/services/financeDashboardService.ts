import { Op } from 'sequelize';
import {
  User,
  CustomerProfile,
  UserPayoutDetail,
  Wallet,
  WalletTransaction,
  Deposit,
  Investment,
  Withdrawal,
} from '../models/index.js';
import {
  UserRole,
  UserStatus,
  DepositStatus,
  InvestmentStatus,
  WithdrawalStatus,
  WalletTxnDirection,
} from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise } from '../utils/money.js';
import { toIso, addDays } from '../utils/dates.js';
import { InvestmentService, serializeInvestment } from './investmentService.js';
import { serializeTransaction } from './walletService.js';
import { serializePayoutDetail } from './profileService.js';

const sumPaise = (values: (number | null | undefined)[]) =>
  values.reduce<number>((acc, v) => acc + toPaise(v ?? 0), 0);

export class FinanceDashboardService {
  /**
   * Admin dashboard: platform-wide investment & wallet metrics
   */
  public static async getStats() {
    await InvestmentService.matureDueInvestments();

    const sevenDaysAhead = addDays(new Date(), 7);

    const [
      totalUsers,
      activeUsers,
      wallets,
      investments,
      deposits,
      withdrawals,
      walletTransactionCount,
      recentTransactions,
      upcomingMaturities,
    ] = await Promise.all([
      User.count({ where: { role: UserRole.CUSTOMER } }),
      User.count({ where: { role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } }),
      Wallet.findAll({ attributes: ['balance'] }),
      Investment.findAll({ attributes: ['amount', 'expected_profit', 'maturity_amount', 'status'] }),
      Deposit.findAll({ attributes: ['amount', 'status'] }),
      Withdrawal.findAll({ attributes: ['total_amount', 'profit_amount', 'status'] }),
      WalletTransaction.count(),
      WalletTransaction.findAll({
        limit: 8,
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email'],
            include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
          },
        ],
      }),
      Investment.findAll({
        where: {
          status: InvestmentStatus.ACTIVE,
          maturity_date: { [Op.lte]: sevenDaysAhead },
        },
        limit: 8,
        order: [['maturity_date', 'ASC']],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email'],
            include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
          },
        ],
      }),
    ]);

    const byStatus = (status: InvestmentStatus) => investments.filter((i) => i.status === status);
    const active = byStatus(InvestmentStatus.ACTIVE);
    const matured = byStatus(InvestmentStatus.MATURED);
    const withdrawalRequested = byStatus(InvestmentStatus.WITHDRAWAL_REQUESTED);
    const completed = byStatus(InvestmentStatus.COMPLETED);
    const nonCancelled = investments.filter((i) => i.status !== InvestmentStatus.CANCELLED);

    const pendingDeposits = deposits.filter((d) => d.status === DepositStatus.PENDING);
    const approvedDeposits = deposits.filter((d) => d.status === DepositStatus.APPROVED);

    const openWithdrawals = withdrawals.filter((w) =>
      [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(w.status)
    );
    const completedWithdrawals = withdrawals.filter((w) => w.status === WithdrawalStatus.COMPLETED);

    return {
      totalUsers,
      activeUsers,
      activeInvestments: active.length,
      activeInvestmentAmount: fromPaise(sumPaise(active.map((i) => i.amount))),
      totalInvestments: nonCancelled.length,
      totalInvestmentAmount: fromPaise(sumPaise(nonCancelled.map((i) => i.amount))),
      // Matured = reached maturity, whether or not the payout has happened yet
      totalMaturedInvestments: matured.length + withdrawalRequested.length + completed.length,
      maturedAwaitingWithdrawal: matured.length,
      maturedAwaitingAmount: fromPaise(sumPaise(matured.map((i) => i.maturity_amount))),
      pendingPaymentVerifications: pendingDeposits.length,
      pendingPaymentAmount: fromPaise(sumPaise(pendingDeposits.map((d) => d.amount))),
      totalDeposited: fromPaise(sumPaise(approvedDeposits.map((d) => d.amount))),
      pendingWithdrawalRequests: openWithdrawals.length,
      pendingWithdrawalAmount: fromPaise(sumPaise(openWithdrawals.map((w) => w.total_amount))),
      totalProfitPaid: fromPaise(sumPaise(completedWithdrawals.map((w) => w.profit_amount))),
      totalWithdrawn: fromPaise(sumPaise(completedWithdrawals.map((w) => w.total_amount))),
      totalWalletBalance: fromPaise(sumPaise(wallets.map((w) => w.balance))),
      walletTransactions: walletTransactionCount,
      investmentStatusDistribution: [
        { name: 'Active', value: active.length, color: '#3b82f6' },
        { name: 'Matured', value: matured.length, color: '#f59e0b' },
        { name: 'Withdrawal Requested', value: withdrawalRequested.length, color: '#8b5cf6' },
        { name: 'Completed', value: completed.length, color: '#10b981' },
        { name: 'Cancelled', value: byStatus(InvestmentStatus.CANCELLED).length, color: '#64748b' },
      ],
      recentTransactions: recentTransactions.map((txn) => {
        const u = (txn as any).user;
        return {
          ...serializeTransaction(txn),
          userId: txn.user_id,
          customerName: u?.profile?.full_name || 'N/A',
          customerEmail: u?.email || 'N/A',
        };
      }),
      upcomingMaturities: upcomingMaturities.map((inv) => {
        const u = (inv as any).user;
        return {
          id: inv.id,
          reference: inv.reference,
          planName: inv.plan_name,
          amount: inv.amount,
          maturityAmount: inv.maturity_amount,
          maturityDate: toIso(inv.maturity_date),
          customerName: u?.profile?.full_name || 'N/A',
          customerEmail: u?.email || 'N/A',
        };
      }),
    };
  }

  /**
   * Admin: wallet, investments and transactions of a single customer
   */
  public static async getCustomerFinance(customerId: number) {
    const user = await User.findOne({
      where: { id: customerId, role: UserRole.CUSTOMER },
      attributes: ['id', 'email', 'phone', 'status'],
      include: [{ model: UserPayoutDetail, as: 'payoutDetail' }],
    });
    if (!user) {
      throw new NotFoundError('Customer not found');
    }

    await InvestmentService.matureDueInvestments(customerId);

    const [wallet, investments, transactions, deposits, withdrawals] = await Promise.all([
      Wallet.findOne({ where: { user_id: customerId } }),
      Investment.findAll({
        where: { user_id: customerId },
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
      }),
      WalletTransaction.findAll({
        where: { user_id: customerId },
        limit: 50,
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
      }),
      Deposit.findAll({
        where: { user_id: customerId },
        limit: 50,
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
      }),
      Withdrawal.findAll({
        where: { user_id: customerId },
        limit: 50,
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
      }),
    ]);

    const locked = investments.filter((i) =>
      [InvestmentStatus.ACTIVE, InvestmentStatus.MATURED, InvestmentStatus.WITHDRAWAL_REQUESTED].includes(i.status)
    );
    const completedWithdrawals = withdrawals.filter((w) => w.status === WithdrawalStatus.COMPLETED);
    const credits = transactions.filter((t) => t.direction === WalletTxnDirection.CREDIT);

    return {
      customerId,
      walletBalance: wallet ? wallet.balance : 0,
      summary: {
        investedAmount: fromPaise(sumPaise(locked.map((i) => i.amount))),
        expectedProfit: fromPaise(sumPaise(locked.map((i) => i.expected_profit))),
        totalDeposited: fromPaise(
          sumPaise(deposits.filter((d) => d.status === DepositStatus.APPROVED).map((d) => d.amount))
        ),
        totalProfitPaid: fromPaise(sumPaise(completedWithdrawals.map((w) => w.profit_amount))),
        totalWithdrawn: fromPaise(sumPaise(completedWithdrawals.map((w) => w.total_amount))),
        investmentsCount: investments.length,
        recentCreditsCount: credits.length,
      },
      payoutDetails: serializePayoutDetail((user as any).payoutDetail || null),
      investments: investments.map(serializeInvestment),
      transactions: transactions.map(serializeTransaction),
      deposits: deposits.map((d) => ({
        id: d.id,
        reference: d.reference,
        amount: d.amount,
        upiTransactionId: d.upi_transaction_id,
        status: d.status,
        createdAt: toIso(d.created_at),
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        reference: w.reference,
        totalAmount: w.total_amount,
        profitAmount: w.profit_amount,
        status: w.status,
        createdAt: toIso(w.created_at),
        completedAt: toIso(w.completed_at),
      })),
    };
  }
}
