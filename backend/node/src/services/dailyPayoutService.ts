import { Op } from 'sequelize';
import {
  sequelize,
  Investment,
  ProfitCredit,
  ReferralCommission,
  SystemSetting,
  User,
  CustomerProfile,
  Withdrawal,
} from '../models/index.js';
import {
  InvestmentStatus,
  NotificationType,
  ProfitPayoutMode,
  ReferralCommissionStatus,
  WalletBucket,
  WalletTxnDirection,
  WalletTxnType,
  WithdrawalSource,
  WithdrawalStatus,
} from '../types/index.js';
import { toPaise, fromPaise, formatInr } from '../utils/money.js';
import { parseDbDate } from '../utils/dates.js';
import { istDayKey, latestPayableDay, cycleNoForDay, payableWorkingDays, PAYOUT_HOUR_IST } from '../utils/workingDays.js';
import { logger } from '../utils/logger.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { WalletService } from './walletService.js';
import { dailyProfitPaise, perCycleCap, termCreditCap } from './investmentPlanService.js';

const LAST_RUN_KEY = 'daily_payout_last_run_at';

export interface DailyPayoutRunResult {
  payableDay: string;
  profitCredits: number;
  profitAmount: number;
  commissions: number;
  commissionAmount: number;
}

/**
 * The 06:00 AM (IST) payout run.
 *
 * 1. Daily profit: every DAILY-mode investment earns its daily credit (monthly rate / 20 for
 *    monthly plans) on each working day (Mon-Fri) after its start day, up to and including its
 *    maturity day, with at most 20 credits per 30-day cycle and, for fixed terms, whole months
 *    in total (a 365-day plan pays 12 x 20 credits). Credits go to the PROFIT bucket of
 *    the wallet and never to the invested capital (no compounding). One ProfitCredit row is
 *    written per investment per day; the unique key on (investment_id, credit_day) makes
 *    re-runs and catch-ups after downtime safe.
 * 2. Referral commission: new commissions are credited instantly when the referred customer
 *    invests (investmentService). This step only settles legacy PENDING rows whose waiting
 *    period has passed, unless the investment was cancelled in the meantime.
 *
 * The job may be called as often as you like; it only pays what is due and not yet paid.
 */
export class DailyPayoutService {
  private static running = false;

  public static async run(now: Date = new Date()): Promise<DailyPayoutRunResult | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const payableDay = latestPayableDay(now);
      const profit = await this.creditDailyProfit(payableDay);
      const commission = await this.creditReferralCommissions(now);

      await SystemSetting.upsert({ setting_key: LAST_RUN_KEY, setting_value: now.toISOString(), updated_by: null });

      if (profit.count > 0 || commission.count > 0) {
        logger.info(
          `[PAYOUT] Up to ${payableDay}: ${profit.count} profit credit(s) totalling ${formatInr(
            fromPaise(profit.paise)
          )}, ${commission.count} referral commission(s) totalling ${formatInr(fromPaise(commission.paise))}`
        );
      }

      return {
        payableDay,
        profitCredits: profit.count,
        profitAmount: fromPaise(profit.paise),
        commissions: commission.count,
        commissionAmount: fromPaise(commission.paise),
      };
    } finally {
      this.running = false;
    }
  }

  public static async getLastRunAt(): Promise<Date | null> {
    const row = await SystemSetting.findByPk(LAST_RUN_KEY);
    return row ? parseDbDate(row.setting_value) : null;
  }

  // ------------------------------------------------------------------ profit

  /**
   * Working days on which `inv` earns profit up to and including `lastDay`, that have not been
   * credited yet, plus the per-day amount.
   */
  private static async unpaidDays(inv: Investment, lastDay: string): Promise<{ days: string[]; perDayPaise: number }> {
    const start = parseDbDate(inv.start_date);
    if (!start) return { days: [], perDayPaise: 0 };

    const firstDay = istDayKey(start);
    // Monthly plans: first 20 working days of each 30-day cycle, and for fixed terms whole
    // months only (365 days = 240 credits), exactly like the expected profit shown on invest
    const dueDays = payableWorkingDays(firstDay, lastDay, perCycleCap(inv), termCreditCap(inv));
    if (dueDays.length === 0) return { days: [], perDayPaise: 0 };

    const already = await ProfitCredit.findAll({
      where: { investment_id: inv.id, credit_day: { [Op.in]: dueDays } },
      attributes: ['credit_day'],
    });
    const paid = new Set(already.map((c) => String(c.credit_day)));
    const perDayPaise = dailyProfitPaise(inv, toPaise(inv.amount));
    return { days: dueDays.filter((d) => !paid.has(d)), perDayPaise };
  }

  /**
   * Latest IST day on which `inv` still earns, given that payouts are due up to `payableDay`:
   * never past the maturity day, and once the customer has asked to withdraw the capital, never
   * past the day whose payout was already due when the request was made ("profit stops now").
   * Open-ended investments (no maturity) otherwise earn until the capital is withdrawn.
   */
  public static async lastEarningDay(inv: Investment, payableDay: string): Promise<string> {
    let lastDay = payableDay;
    const maturity = parseDbDate(inv.maturity_date);
    if (maturity && istDayKey(maturity) < lastDay) lastDay = istDayKey(maturity);

    if (inv.status === InvestmentStatus.WITHDRAWAL_REQUESTED) {
      const request = await Withdrawal.findOne({
        where: {
          investment_id: inv.id,
          source: WithdrawalSource.INVESTMENT,
          status: { [Op.in]: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED] },
        },
        order: [['id', 'DESC']],
        attributes: ['id', 'created_at'],
      });
      const requestedAt = request ? parseDbDate(request.created_at) : null;
      if (requestedAt) {
        const cutoff = latestPayableDay(requestedAt);
        if (cutoff < lastDay) lastDay = cutoff;
      }
    }
    return lastDay;
  }

  /**
   * Credits every unpaid profit day of one investment up to `lastDay` (inclusive). Used by the
   * daily run and by the maturity flow, which settles the final days before returning the
   * capital. Returns the number of credits made and their total.
   */
  public static async creditInvestmentUpTo(inv: Investment, lastDay: string): Promise<{ count: number; paise: number; days: string[] }> {
    if (inv.payout_mode !== ProfitPayoutMode.DAILY) return { count: 0, paise: 0, days: [] };

    const { days, perDayPaise } = await this.unpaidDays(inv, lastDay);
    if (days.length === 0 || perDayPaise <= 0) return { count: 0, paise: 0, days: [] };

    const startKey = istDayKey(parseDbDate(inv.start_date)!);
    const credited: string[] = [];
    for (const day of days) {
      if (await this.creditOneDay(inv, day, cycleNoForDay(startKey, day), perDayPaise)) credited.push(day);
    }
    return { count: credited.length, paise: credited.length * perDayPaise, days: credited };
  }

  private static async creditDailyProfit(payableDay: string): Promise<{ count: number; paise: number }> {
    // Investments that can still earn on some day <= payableDay. Matured / withdrawal-requested
    // investments are included so that days missed while the server was down are still paid.
    const investments = await Investment.findAll({
      where: {
        payout_mode: ProfitPayoutMode.DAILY,
        status: {
          [Op.in]: [InvestmentStatus.ACTIVE, InvestmentStatus.MATURED, InvestmentStatus.WITHDRAWAL_REQUESTED],
        },
      },
      order: [['id', 'ASC']],
    });

    let count = 0;
    let paise = 0;
    const perUser = new Map<number, { paise: number; days: Set<string>; investments: Set<string> }>();

    for (const inv of investments) {
      const result = await this.creditInvestmentUpTo(inv, await this.lastEarningDay(inv, payableDay));
      if (result.count === 0) continue;
      count += result.count;
      paise += result.paise;

      const entry = perUser.get(inv.user_id) ?? { paise: 0, days: new Set<string>(), investments: new Set<string>() };
      entry.paise += result.paise;
      result.days.forEach((d) => entry.days.add(d));
      entry.investments.add(inv.reference);
      perUser.set(inv.user_id, entry);
    }

    // One notification per customer per run, so a catch-up after downtime does not flood them
    for (const [userId, entry] of perUser) {
      const days = [...entry.days].sort();
      const dayText = days.length === 1 ? `for ${days[0]}` : `for ${days.length} working days (${days[0]} to ${days[days.length - 1]})`;
      await NotificationService.notify({
        userId,
        type: NotificationType.PROFIT_CREDITED,
        title: 'Daily profit credited',
        message: `${formatInr(fromPaise(entry.paise))} profit ${dayText} has been credited to your profit wallet from ${
          entry.investments.size === 1 ? `investment ${[...entry.investments][0]}` : `${entry.investments.size} investments`
        }. You can withdraw it any time.`,
        relatedEntity: 'WALLET',
      });
    }

    return { count, paise };
  }

  /**
   * Credits one working day for one investment atomically. Returns false when another
   * run already credited that day (unique key) so nothing is paid twice.
   */
  private static async creditOneDay(inv: Investment, day: string, cycleNo: number, perDayPaise: number): Promise<boolean> {
    try {
      await sequelize.transaction(async (t) => {
        const credit = await ProfitCredit.create(
          {
            investment_id: inv.id,
            user_id: inv.user_id,
            credit_day: day,
            cycle_no: cycleNo,
            amount: fromPaise(perDayPaise),
          },
          { transaction: t }
        );

        const txn = await WalletService.applyEntry(
          {
            userId: inv.user_id,
            type: WalletTxnType.PROFIT,
            direction: WalletTxnDirection.CREDIT,
            bucket: WalletBucket.PROFIT,
            amountPaise: perDayPaise,
            description: `Daily profit for ${day} on investment ${inv.reference} (${inv.plan_name})`,
            relatedEntity: 'INVESTMENT',
            relatedId: inv.id,
          },
          t
        );

        credit.wallet_transaction_id = txn.id;
        await credit.save({ transaction: t });

        await Investment.increment({ profit_credited: fromPaise(perDayPaise) }, { where: { id: inv.id }, transaction: t });
      });
      return true;
    } catch (err: any) {
      if (err?.name === 'SequelizeUniqueConstraintError') return false;
      logger.error(`[PAYOUT] Failed to credit ${day} for investment ${inv.reference}`, err);
      return false;
    }
  }

  // -------------------------------------------------------------- commissions

  private static async creditReferralCommissions(now: Date): Promise<{ count: number; paise: number }> {
    const due = await ReferralCommission.findAll({
      where: { status: ReferralCommissionStatus.PENDING, eligible_at: { [Op.lte]: now } },
      include: [{ model: Investment, as: 'investment', attributes: ['id', 'reference', 'status', 'plan_name'] }],
      order: [['id', 'ASC']],
    });

    let count = 0;
    let paise = 0;

    for (const commission of due) {
      const inv: Investment | undefined = (commission as any).investment;

      // The referred customer's investment was cancelled before the commission fell due
      if (!inv || inv.status === InvestmentStatus.CANCELLED) {
        commission.status = ReferralCommissionStatus.CANCELLED;
        commission.cancelled_at = now;
        await commission.save();
        continue;
      }

      const amountPaise = toPaise(commission.amount);
      if (amountPaise <= 0) {
        commission.status = ReferralCommissionStatus.CANCELLED;
        commission.cancelled_at = now;
        await commission.save();
        continue;
      }

      try {
        await sequelize.transaction(async (t) => {
          const fresh = await ReferralCommission.findByPk(commission.id, { transaction: t, lock: t.LOCK.UPDATE });
          if (!fresh || fresh.status !== ReferralCommissionStatus.PENDING) return;

          const txn = await WalletService.applyEntry(
            {
              userId: fresh.referrer_user_id,
              type: WalletTxnType.REFERRAL_COMMISSION,
              direction: WalletTxnDirection.CREDIT,
              bucket: WalletBucket.PROFIT,
              amountPaise,
              description: `Referral commission (${fresh.commission_percent}%) on investment ${inv.reference} by referred customer #${fresh.referred_user_id}`,
              relatedEntity: 'REFERRAL_COMMISSION',
              relatedId: fresh.id,
            },
            t
          );

          fresh.status = ReferralCommissionStatus.CREDITED;
          fresh.credited_at = now;
          fresh.wallet_transaction_id = txn.id;
          await fresh.save({ transaction: t });
          count += 1;
          paise += amountPaise;
        });
      } catch (err) {
        logger.error(`[PAYOUT] Failed to credit referral commission #${commission.id}`, err);
        continue;
      }

      const referred = await User.findByPk(commission.referred_user_id, {
        attributes: ['id'],
        include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
      });
      const referredName = (referred as any)?.profile?.full_name || 'a customer you referred';

      await ActivityLogService.log({
        userId: commission.referrer_user_id,
        action: 'REFERRAL_COMMISSION_CREDITED',
        entity: 'REFERRAL_COMMISSION',
        entityId: commission.id,
        description: `Referral commission of ${formatInr(commission.amount)} credited to user #${commission.referrer_user_id} for investment ${inv.reference} of user #${commission.referred_user_id}`,
      });

      await NotificationService.notify({
        userId: commission.referrer_user_id,
        type: NotificationType.REFERRAL_COMMISSION,
        title: 'Referral commission credited',
        message: `${formatInr(commission.amount)} referral commission (${commission.commission_percent}% of ${formatInr(
          commission.investment_amount
        )} invested by ${referredName}) has been credited to your profit wallet.`,
        relatedEntity: 'REFERRAL_COMMISSION',
        relatedId: commission.id,
      });
    }

    return { count, paise };
  }

  /** Human readable description of the payout schedule, for API responses */
  public static scheduleDescription(): string {
    return `Every working day (Monday to Friday) at ${PAYOUT_HOUR_IST}:00 AM IST`;
  }
}
