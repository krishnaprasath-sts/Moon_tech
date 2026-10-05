import { Op } from 'sequelize';
import {
  User,
  CustomerProfile,
  KycProfile,
  Wallet,
  WalletTransaction,
  Deposit,
  Investment,
  Withdrawal,
} from '../models/index.js';
import {
  UserRole,
  DepositStatus,
  InvestmentStatus,
  WithdrawalStatus,
  WalletTxnDirection,
} from '../types/index.js';
import { BadRequestError } from '../utils/errors.js';
import { toPaise, fromPaise } from '../utils/money.js';
import { toIso, parseDateRange } from '../utils/dates.js';
import { InvestmentService } from './investmentService.js';

export const REPORT_TYPES = [
  'users',
  'wallet',
  'investments',
  'profit',
  'maturity',
  'withdrawals',
  'payments',
  'transactions',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportColumn {
  key: string;
  label: string;
  type?: 'text' | 'money' | 'date' | 'number';
}

export interface ReportResult {
  type: ReportType;
  title: string;
  generatedAt: string;
  startDate: string | null;
  endDate: string | null;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary: { label: string; value: number | string; type?: 'money' | 'number' | 'text' }[];
  truncated: boolean;
}

const MAX_ROWS = 5000;

const sumPaise = (values: (number | null | undefined)[]) =>
  values.reduce<number>((acc, v) => acc + toPaise(v ?? 0), 0);

const userInclude = {
  model: User,
  as: 'user',
  attributes: ['id', 'email', 'phone'],
  include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
};

const customerFields = (row: any) => ({
  customerId: row.user_id,
  customerName: row.user?.profile?.full_name || 'N/A',
  customerEmail: row.user?.email || 'N/A',
});

const customerColumns: ReportColumn[] = [
  { key: 'customerId', label: 'Customer ID', type: 'number' },
  { key: 'customerName', label: 'Customer' },
  { key: 'customerEmail', label: 'Email' },
];

export class ReportService {
  private static dateWhere(field: string, startDate?: string, endDate?: string) {
    const { start, end } = parseDateRange(startDate, endDate);
    if (start && end) {
      if (start.getTime() > end.getTime()) {
        throw new BadRequestError('Start date must be on or before the end date');
      }
      return { [field]: { [Op.between]: [start, end] } };
    }
    if (start) return { [field]: { [Op.gte]: start } };
    if (end) return { [field]: { [Op.lte]: end } };
    return {};
  }

  public static async generate(
    type: string,
    params: { startDate?: string; endDate?: string }
  ): Promise<ReportResult> {
    if (!REPORT_TYPES.includes(type as ReportType)) {
      throw new BadRequestError(`Unknown report type "${type}". Valid types: ${REPORT_TYPES.join(', ')}`);
    }

    await InvestmentService.matureDueInvestments();

    const reportType = type as ReportType;
    const { startDate, endDate } = params;

    let body: Pick<ReportResult, 'title' | 'columns' | 'rows' | 'summary'>;

    switch (reportType) {
      case 'users':
        body = await this.usersReport(startDate, endDate);
        break;
      case 'wallet':
        body = await this.walletReport();
        break;
      case 'investments':
        body = await this.investmentsReport(startDate, endDate);
        break;
      case 'profit':
        body = await this.profitReport(startDate, endDate);
        break;
      case 'maturity':
        body = await this.maturityReport(startDate, endDate);
        break;
      case 'withdrawals':
        body = await this.withdrawalsReport(startDate, endDate);
        break;
      case 'payments':
        body = await this.paymentsReport(startDate, endDate);
        break;
      default:
        body = await this.transactionsReport(startDate, endDate);
        break;
    }

    const truncated = body.rows.length > MAX_ROWS;

    return {
      type: reportType,
      generatedAt: new Date().toISOString(),
      startDate: startDate || null,
      endDate: endDate || null,
      ...body,
      rows: truncated ? body.rows.slice(0, MAX_ROWS) : body.rows,
      truncated,
    };
  }

  private static async usersReport(startDate?: string, endDate?: string) {
    const users = await User.findAll({
      where: { role: UserRole.CUSTOMER, ...this.dateWhere('created_at', startDate, endDate) },
      limit: MAX_ROWS + 1,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'email', 'phone', 'status', 'last_login_at', 'created_at'],
      include: [
        { model: CustomerProfile, as: 'profile', attributes: ['full_name', 'city', 'state'] },
        { model: KycProfile, as: 'kyc', attributes: ['kyc_status'] },
        { model: Wallet, as: 'wallet', attributes: ['balance'] },
      ],
    });

    const rows = users.map((u: any) => ({
      customerId: u.id,
      customerName: u.profile?.full_name || 'N/A',
      email: u.email,
      phone: u.phone,
      city: u.profile?.city || '',
      state: u.profile?.state || '',
      accountStatus: u.status,
      kycStatus: u.kyc?.kyc_status || 'DRAFT',
      walletBalance: u.wallet ? u.wallet.balance : 0,
      lastLoginAt: toIso(u.last_login_at),
      registeredAt: toIso(u.created_at),
    }));

    return {
      title: 'User Report',
      columns: [
        { key: 'customerId', label: 'Customer ID', type: 'number' },
        { key: 'customerName', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Mobile' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'accountStatus', label: 'Account Status' },
        { key: 'kycStatus', label: 'KYC Status' },
        { key: 'walletBalance', label: 'Wallet Balance', type: 'money' },
        { key: 'lastLoginAt', label: 'Last Login', type: 'date' },
        { key: 'registeredAt', label: 'Registered On', type: 'date' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Total Users', value: rows.length, type: 'number' as const },
        { label: 'Active Users', value: rows.filter((r) => r.accountStatus === 'ACTIVE').length, type: 'number' as const },
        {
          label: 'Total Wallet Balance',
          value: fromPaise(sumPaise(rows.map((r) => r.walletBalance))),
          type: 'money' as const,
        },
      ],
    };
  }

  /**
   * Current wallet position per customer (not date-bound)
   */
  private static async walletReport() {
    const wallets = await Wallet.findAll({
      limit: MAX_ROWS + 1,
      order: [['balance', 'DESC']],
      include: [userInclude],
    });

    const transactions = await WalletTransaction.findAll({
      attributes: ['user_id', 'direction', 'amount'],
    });

    const totals = new Map<number, { credits: number; debits: number; count: number }>();
    for (const txn of transactions) {
      const entry = totals.get(txn.user_id) || { credits: 0, debits: 0, count: 0 };
      if (txn.direction === WalletTxnDirection.CREDIT) entry.credits += toPaise(txn.amount);
      else entry.debits += toPaise(txn.amount);
      entry.count += 1;
      totals.set(txn.user_id, entry);
    }

    const rows = wallets.map((w: any) => {
      const entry = totals.get(w.user_id) || { credits: 0, debits: 0, count: 0 };
      return {
        ...customerFields(w),
        balance: w.balance,
        totalCredits: fromPaise(entry.credits),
        totalDebits: fromPaise(entry.debits),
        transactionCount: entry.count,
        lastUpdatedAt: toIso(w.updated_at),
      };
    });

    return {
      title: 'Wallet Report',
      columns: [
        ...customerColumns,
        { key: 'balance', label: 'Current Balance', type: 'money' },
        { key: 'totalCredits', label: 'Total Credits', type: 'money' },
        { key: 'totalDebits', label: 'Total Debits', type: 'money' },
        { key: 'transactionCount', label: 'Transactions', type: 'number' },
        { key: 'lastUpdatedAt', label: 'Last Updated', type: 'date' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Wallets', value: rows.length, type: 'number' as const },
        { label: 'Total Balance', value: fromPaise(sumPaise(rows.map((r) => r.balance))), type: 'money' as const },
        { label: 'Total Credits', value: fromPaise(sumPaise(rows.map((r) => r.totalCredits))), type: 'money' as const },
        { label: 'Total Debits', value: fromPaise(sumPaise(rows.map((r) => r.totalDebits))), type: 'money' as const },
      ],
    };
  }

  private static async investmentsReport(startDate?: string, endDate?: string) {
    const investments = await Investment.findAll({
      where: this.dateWhere('created_at', startDate, endDate),
      limit: MAX_ROWS + 1,
      order: [['created_at', 'DESC']],
      include: [userInclude],
    });

    const rows = investments.map((i: any) => ({
      reference: i.reference,
      ...customerFields(i),
      planName: i.plan_name,
      amount: i.amount,
      expectedProfit: i.expected_profit,
      maturityAmount: i.maturity_amount,
      durationDays: i.duration_days,
      startDate: toIso(i.start_date),
      maturityDate: toIso(i.maturity_date),
      status: i.status,
    }));

    const counted = rows.filter((r) => r.status !== InvestmentStatus.CANCELLED);

    return {
      title: 'Investment Report',
      columns: [
        { key: 'reference', label: 'Investment ID' },
        ...customerColumns,
        { key: 'planName', label: 'Plan' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'expectedProfit', label: 'Expected Profit', type: 'money' },
        { key: 'maturityAmount', label: 'Maturity Amount', type: 'money' },
        { key: 'durationDays', label: 'Period (Days)', type: 'number' },
        { key: 'startDate', label: 'Start Date', type: 'date' },
        { key: 'maturityDate', label: 'Maturity Date', type: 'date' },
        { key: 'status', label: 'Status' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Investments', value: rows.length, type: 'number' as const },
        { label: 'Total Invested', value: fromPaise(sumPaise(counted.map((r) => r.amount))), type: 'money' as const },
        {
          label: 'Expected Profit',
          value: fromPaise(sumPaise(counted.map((r) => r.expectedProfit))),
          type: 'money' as const,
        },
        {
          label: 'Active',
          value: rows.filter((r) => r.status === InvestmentStatus.ACTIVE).length,
          type: 'number' as const,
        },
      ],
    };
  }

  /**
   * Profit actually paid out, by payout completion date
   */
  private static async profitReport(startDate?: string, endDate?: string) {
    const withdrawals = await Withdrawal.findAll({
      where: {
        status: WithdrawalStatus.COMPLETED,
        ...this.dateWhere('completed_at', startDate, endDate),
      },
      limit: MAX_ROWS + 1,
      order: [['completed_at', 'DESC']],
      include: [userInclude, { model: Investment, as: 'investment', attributes: ['reference', 'plan_name'] }],
    });

    const rows = withdrawals.map((w: any) => ({
      withdrawalReference: w.reference,
      investmentReference: w.investment?.reference || '',
      ...customerFields(w),
      planName: w.investment?.plan_name || '',
      principalAmount: w.principal_amount,
      profitAmount: w.profit_amount,
      totalPaid: w.total_amount,
      paidAt: toIso(w.completed_at),
    }));

    return {
      title: 'Profit Report',
      columns: [
        { key: 'withdrawalReference', label: 'Withdrawal ID' },
        { key: 'investmentReference', label: 'Investment ID' },
        ...customerColumns,
        { key: 'planName', label: 'Plan' },
        { key: 'principalAmount', label: 'Principal', type: 'money' },
        { key: 'profitAmount', label: 'Profit Paid', type: 'money' },
        { key: 'totalPaid', label: 'Total Paid', type: 'money' },
        { key: 'paidAt', label: 'Paid On', type: 'date' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Payouts', value: rows.length, type: 'number' as const },
        {
          label: 'Total Profit Paid',
          value: fromPaise(sumPaise(rows.map((r) => r.profitAmount))),
          type: 'money' as const,
        },
        {
          label: 'Total Principal Returned',
          value: fromPaise(sumPaise(rows.map((r) => r.principalAmount))),
          type: 'money' as const,
        },
      ],
    };
  }

  /**
   * Investments by maturity date (past and upcoming)
   */
  private static async maturityReport(startDate?: string, endDate?: string) {
    const investments = await Investment.findAll({
      where: {
        status: { [Op.ne]: InvestmentStatus.CANCELLED },
        ...this.dateWhere('maturity_date', startDate, endDate),
      },
      limit: MAX_ROWS + 1,
      order: [['maturity_date', 'ASC']],
      include: [userInclude],
    });

    const rows = investments.map((i: any) => ({
      reference: i.reference,
      ...customerFields(i),
      planName: i.plan_name,
      amount: i.amount,
      expectedProfit: i.expected_profit,
      maturityAmount: i.maturity_amount,
      maturityDate: toIso(i.maturity_date),
      status: i.status,
    }));

    const unpaid = rows.filter((r) =>
      [InvestmentStatus.ACTIVE, InvestmentStatus.MATURED, InvestmentStatus.WITHDRAWAL_REQUESTED].includes(r.status)
    );

    return {
      title: 'Maturity Report',
      columns: [
        { key: 'reference', label: 'Investment ID' },
        ...customerColumns,
        { key: 'planName', label: 'Plan' },
        { key: 'amount', label: 'Principal', type: 'money' },
        { key: 'expectedProfit', label: 'Profit', type: 'money' },
        { key: 'maturityAmount', label: 'Maturity Amount', type: 'money' },
        { key: 'maturityDate', label: 'Maturity Date', type: 'date' },
        { key: 'status', label: 'Status' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Investments', value: rows.length, type: 'number' as const },
        {
          label: 'Total Maturity Value',
          value: fromPaise(sumPaise(rows.map((r) => r.maturityAmount))),
          type: 'money' as const,
        },
        {
          label: 'Outstanding Liability',
          value: fromPaise(sumPaise(unpaid.map((r) => r.maturityAmount))),
          type: 'money' as const,
        },
      ],
    };
  }

  private static async withdrawalsReport(startDate?: string, endDate?: string) {
    const withdrawals = await Withdrawal.findAll({
      where: this.dateWhere('created_at', startDate, endDate),
      limit: MAX_ROWS + 1,
      order: [['created_at', 'DESC']],
      include: [userInclude, { model: Investment, as: 'investment', attributes: ['reference'] }],
    });

    const rows = withdrawals.map((w: any) => ({
      reference: w.reference,
      investmentReference: w.investment?.reference || '',
      ...customerFields(w),
      principalAmount: w.principal_amount,
      profitAmount: w.profit_amount,
      totalAmount: w.total_amount,
      payoutMethod: w.payout_method,
      paymentReference: w.payment_reference || '',
      status: w.status,
      requestedAt: toIso(w.created_at),
      completedAt: toIso(w.completed_at),
    }));

    const completed = rows.filter((r) => r.status === WithdrawalStatus.COMPLETED);
    const open = rows.filter((r) => [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(r.status));

    return {
      title: 'Withdrawal Report',
      columns: [
        { key: 'reference', label: 'Withdrawal ID' },
        { key: 'investmentReference', label: 'Investment ID' },
        ...customerColumns,
        { key: 'principalAmount', label: 'Principal', type: 'money' },
        { key: 'profitAmount', label: 'Profit', type: 'money' },
        { key: 'totalAmount', label: 'Total Payable', type: 'money' },
        { key: 'payoutMethod', label: 'Payout Method' },
        { key: 'paymentReference', label: 'Payment Ref' },
        { key: 'status', label: 'Status' },
        { key: 'requestedAt', label: 'Requested On', type: 'date' },
        { key: 'completedAt', label: 'Completed On', type: 'date' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Requests', value: rows.length, type: 'number' as const },
        { label: 'Paid Out', value: fromPaise(sumPaise(completed.map((r) => r.totalAmount))), type: 'money' as const },
        { label: 'Awaiting Payout', value: fromPaise(sumPaise(open.map((r) => r.totalAmount))), type: 'money' as const },
      ],
    };
  }

  private static async paymentsReport(startDate?: string, endDate?: string) {
    const deposits = await Deposit.findAll({
      where: this.dateWhere('created_at', startDate, endDate),
      limit: MAX_ROWS + 1,
      order: [['created_at', 'DESC']],
      include: [userInclude],
    });

    const rows = deposits.map((d: any) => ({
      reference: d.reference,
      ...customerFields(d),
      amount: d.amount,
      upiTransactionId: d.upi_transaction_id,
      status: d.status,
      rejectionReason: d.rejection_reason || '',
      submittedAt: toIso(d.created_at),
      reviewedAt: toIso(d.reviewed_at),
    }));

    const amountFor = (status: DepositStatus) =>
      fromPaise(sumPaise(rows.filter((r) => r.status === status).map((r) => r.amount)));

    return {
      title: 'Payment Report',
      columns: [
        { key: 'reference', label: 'Payment ID' },
        ...customerColumns,
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'upiTransactionId', label: 'UPI Transaction ID' },
        { key: 'status', label: 'Status' },
        { key: 'rejectionReason', label: 'Rejection Reason' },
        { key: 'submittedAt', label: 'Submitted On', type: 'date' },
        { key: 'reviewedAt', label: 'Reviewed On', type: 'date' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Submissions', value: rows.length, type: 'number' as const },
        { label: 'Approved', value: amountFor(DepositStatus.APPROVED), type: 'money' as const },
        { label: 'Pending', value: amountFor(DepositStatus.PENDING), type: 'money' as const },
        { label: 'Rejected', value: amountFor(DepositStatus.REJECTED), type: 'money' as const },
      ],
    };
  }

  private static async transactionsReport(startDate?: string, endDate?: string) {
    const transactions = await WalletTransaction.findAll({
      where: this.dateWhere('created_at', startDate, endDate),
      limit: MAX_ROWS + 1,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [userInclude],
    });

    const rows = transactions.map((t: any) => ({
      reference: t.reference,
      date: toIso(t.created_at),
      ...customerFields(t),
      type: t.type,
      direction: t.direction,
      amount: t.amount,
      balanceBefore: t.balance_before,
      balanceAfter: t.balance_after,
      description: t.description,
    }));

    const amountFor = (direction: WalletTxnDirection) =>
      fromPaise(sumPaise(rows.filter((r) => r.direction === direction).map((r) => r.amount)));

    return {
      title: 'Date-wise Transaction Report',
      columns: [
        { key: 'reference', label: 'Transaction ID' },
        { key: 'date', label: 'Date', type: 'date' },
        ...customerColumns,
        { key: 'type', label: 'Type' },
        { key: 'direction', label: 'Direction' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'balanceBefore', label: 'Balance Before', type: 'money' },
        { key: 'balanceAfter', label: 'Balance After', type: 'money' },
        { key: 'description', label: 'Description' },
      ] as ReportColumn[],
      rows,
      summary: [
        { label: 'Transactions', value: rows.length, type: 'number' as const },
        { label: 'Total Credits', value: amountFor(WalletTxnDirection.CREDIT), type: 'money' as const },
        { label: 'Total Debits', value: amountFor(WalletTxnDirection.DEBIT), type: 'money' as const },
      ],
    };
  }

  /**
   * Renders a report as CSV (RFC 4180, with formula-injection guarding)
   */
  public static toCsv(report: ReportResult): string {
    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      let text = String(value);
      if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
      }
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const lines = [report.columns.map((c) => escape(c.label)).join(',')];
    for (const row of report.rows) {
      lines.push(report.columns.map((c) => escape(row[c.key])).join(','));
    }

    // BOM so Excel detects UTF-8
    return `﻿${lines.join('\r\n')}\r\n`;
  }
}
