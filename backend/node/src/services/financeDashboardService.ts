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
  ProfitCredit,
  ReferralCommission,
} from '../models/index.js';
import {
  UserRole,
  UserStatus,
  DepositStatus,
  InvestmentStatus,
  WithdrawalStatus,
  WithdrawalSource,
  WalletTxnDirection,
  WalletTxnType,
  ReferralCommissionStatus,
  JwtUserPayload,
} from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise } from '../utils/money.js';
import { toIso, addDays } from '../utils/dates.js';
import { decryptData } from '../utils/encryption.js';
import { DailyPayoutService } from './dailyPayoutService.js';
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
      profitCredits,
      commissions,
      lastPayoutRunAt,
      profitLedger,
    ] = await Promise.all([
      User.count({ where: { role: UserRole.CUSTOMER } }),
      User.count({ where: { role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } }),
      Wallet.findAll({ attributes: ['balance', 'capital_balance', 'profit_balance'] }),
      Investment.findAll({ attributes: ['amount', 'expected_profit', 'maturity_amount', 'status'] }),
      Deposit.findAll({ attributes: ['amount', 'status'] }),
      Withdrawal.findAll({ attributes: ['total_amount', 'profit_amount', 'fee_amount', 'net_amount', 'status', 'source', 'bucket'] }),
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
      ProfitCredit.findAll({ attributes: ['amount'] }),
      ReferralCommission.findAll({ attributes: ['amount', 'status'] }),
      DailyPayoutService.getLastRunAt(),
      // Every profit credit that reached a wallet: daily credits and profit paid at maturity
      WalletTransaction.findAll({
        where: { type: WalletTxnType.PROFIT, direction: WalletTxnDirection.CREDIT },
        attributes: ['amount'],
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
    const dailyProfitPaise = sumPaise(profitCredits.map((c) => c.amount));
    const creditedCommissions = commissions.filter((c) => c.status === ReferralCommissionStatus.CREDITED);
    const pendingCommissions = commissions.filter((c) => c.status === ReferralCommissionStatus.PENDING);

    return {
      totalUsers,
      activeUsers,
      // Daily profit credited to wallets by the 06:00 AM payout job
      totalDailyProfitCredited: fromPaise(dailyProfitPaise),
      dailyProfitCredits: profitCredits.length,
      totalReferralCommissionPaid: fromPaise(sumPaise(creditedCommissions.map((c) => c.amount))),
      pendingReferralCommissionAmount: fromPaise(sumPaise(pendingCommissions.map((c) => c.amount))),
      pendingReferralCommissions: pendingCommissions.length,
      lastPayoutRunAt: lastPayoutRunAt ? lastPayoutRunAt.toISOString() : null,
      payoutSchedule: DailyPayoutService.scheduleDescription(),
      walletWithdrawalsPending: withdrawals.filter(
        (w) => w.source === WithdrawalSource.WALLET && [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(w.status)
      ).length,
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
      // Profit paid at maturity + profit credited daily (PROFIT ledger credits)
      totalProfitPaid: fromPaise(sumPaise(profitLedger.map((t) => t.amount))),
      // Net amount actually paid to customers, and the capital withdrawal fees retained
      totalWithdrawn: fromPaise(sumPaise(completedWithdrawals.map((w) => w.net_amount))),
      totalWithdrawalFees: fromPaise(sumPaise(completedWithdrawals.map((w) => w.fee_amount))),
      totalWalletBalance: fromPaise(sumPaise(wallets.map((w) => w.balance))),
      totalCapitalBalance: fromPaise(sumPaise(wallets.map((w) => w.capital_balance))),
      totalProfitBalance: fromPaise(sumPaise(wallets.map((w) => w.profit_balance))),
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
  public static async getCustomerFinance(customerId: number, requestingUser?: JwtUserPayload) {
    const user = await User.findOne({
      where: { id: customerId, role: UserRole.CUSTOMER },
      attributes: ['id', 'email', 'phone', 'status'],
      include: [{ model: UserPayoutDetail, as: 'payoutDetail' }],
    });
    if (!user) {
      throw new NotFoundError('Customer not found');
    }

    await InvestmentService.matureDueInvestments(customerId);

    // Managers process payouts by hand, so they may see the full account number. Editors only get the mask.
    const canSeeFullAccount = Boolean(
      requestingUser && [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(requestingUser.role)
    );

    const [wallet, investments, transactions, deposits, withdrawals, profitCredits, commissionsEarned, profitLedger] = await Promise.all([
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
      ProfitCredit.findAll({ where: { user_id: customerId }, attributes: ['amount'] }),
      ReferralCommission.findAll({ where: { referrer_user_id: customerId }, attributes: ['amount', 'status'] }),
      WalletTransaction.findAll({
        where: { user_id: customerId, type: WalletTxnType.PROFIT, direction: WalletTxnDirection.CREDIT },
        attributes: ['amount'],
      }),
    ]);

    const locked = investments.filter((i) =>
      [InvestmentStatus.ACTIVE, InvestmentStatus.MATURED, InvestmentStatus.WITHDRAWAL_REQUESTED].includes(i.status)
    );
    const completedWithdrawals = withdrawals.filter((w) => w.status === WithdrawalStatus.COMPLETED);
    const credits = transactions.filter((t) => t.direction === WalletTxnDirection.CREDIT);
    const dailyProfitPaise = sumPaise(profitCredits.map((c) => c.amount));

    const payoutDetail: UserPayoutDetail | null = (user as any).payoutDetail || null;
    const payoutDetails = serializePayoutDetail(payoutDetail);

    return {
      customerId,
      walletBalance: wallet ? wallet.balance : 0,
      capitalBalance: wallet ? wallet.capital_balance : 0,
      profitBalance: wallet ? wallet.profit_balance : 0,
      summary: {
        investedAmount: fromPaise(sumPaise(locked.map((i) => i.amount))),
        expectedProfit: fromPaise(sumPaise(locked.map((i) => i.expected_profit))),
        totalDeposited: fromPaise(
          sumPaise(deposits.filter((d) => d.status === DepositStatus.APPROVED).map((d) => d.amount))
        ),
        totalProfitPaid: fromPaise(sumPaise(profitLedger.map((t) => t.amount))),
        dailyProfitCredited: fromPaise(dailyProfitPaise),
        referralCommissionEarned: fromPaise(
          sumPaise(commissionsEarned.filter((c) => c.status === ReferralCommissionStatus.CREDITED).map((c) => c.amount))
        ),
        referralCommissionPending: fromPaise(
          sumPaise(commissionsEarned.filter((c) => c.status === ReferralCommissionStatus.PENDING).map((c) => c.amount))
        ),
        totalWithdrawn: fromPaise(sumPaise(completedWithdrawals.map((w) => w.net_amount))),
        totalWithdrawalFees: fromPaise(sumPaise(completedWithdrawals.map((w) => w.fee_amount))),
        investmentsCount: investments.length,
        recentCreditsCount: credits.length,
      },
      payoutDetails: payoutDetails
        ? {
            ...payoutDetails,
            accountNumber:
              canSeeFullAccount && payoutDetail?.account_number_encrypted
                ? decryptData(payoutDetail.account_number_encrypted) || null
                : null,
          }
        : null,
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
        source: w.source,
        bucket: w.bucket,
        totalAmount: w.total_amount,
        profitAmount: w.profit_amount,
        feeAmount: w.fee_amount,
        netAmount: w.net_amount,
        status: w.status,
        createdAt: toIso(w.created_at),
        completedAt: toIso(w.completed_at),
      })),
    };
  }
}
