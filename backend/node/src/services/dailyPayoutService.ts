import { Op } from 'sequelize';
import {
  sequelize,
  Investment,
  ProfitCredit,
  Referral,
  ReferralCommission,
  ReferralDailyCredit,
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
  UserRole,
  UserStatus,
  WalletBucket,
  WalletTxnDirection,
  WalletTxnType,
  WithdrawalSource,
  WithdrawalStatus,
} from '../types/index.js';
import { toPaise, fromPaise, formatInr } from '../utils/money.js';
import { parseDbDate } from '../utils/dates.js';
import {
  istDayKey,
  latestPayableDay,
  cycleNoForDay,
  payableWorkingDays,
  maxCreditsForTerm,
  monthlyDueDates,
  PAYOUT_HOUR_IST,
  WORKING_DAYS_PER_MONTH,
} from '../utils/workingDays.js';
import { logger } from '../utils/logger.js';
import { ActivityLogService } from './activityLogService.js';
import { NotificationService } from './notificationService.js';
import { WalletService } from './walletService.js';
import { SettingsService } from './settingsService.js';
import { dailyProfitPaise, perCycleCap, termCreditCap, percentOfPaise } from './investmentPlanService.js';

const LAST_RUN_KEY = 'daily_payout_last_run_at';

export interface DailyPayoutRunResult {
  payableDay: string;
  profitCredits: number;
  profitAmount: number;
  commissions: number;
  commissionAmount: number;
  dailyReferralCredits?: number;
  dailyReferralAmount?: number;
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
      const dailyRef = await this.creditDailyReferralCommissions(payableDay, now);

      await SystemSetting.upsert({ setting_key: LAST_RUN_KEY, setting_value: now.toISOString(), updated_by: null });

      if (profit.count > 0 || commission.count > 0 || dailyRef.count > 0) {
        logger.info(
          `[PAYOUT] Up to ${payableDay}: ${profit.count} profit credit(s) totalling ${formatInr(
            fromPaise(profit.paise)
          )}, ${commission.count} one-time referral commission(s) totalling ${formatInr(
            fromPaise(commission.paise)
          )}, ${dailyRef.count} daily referral commission(s) totalling ${formatInr(fromPaise(dailyRef.paise))}`
        );
      }

      return {
        payableDay,
        profitCredits: profit.count,
        profitAmount: fromPaise(profit.paise),
        commissions: commission.count,
        commissionAmount: fromPaise(commission.paise),
        dailyReferralCredits: dailyRef.count,
        dailyReferralAmount: fromPaise(dailyRef.paise),
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
   * Days on which `inv` earns profit up to and including `lastDay`, that have not been
   * credited yet, plus the per-payout amount.
   */
  private static async unpaidDays(
    inv: Investment,
    lastDay: string
  ): Promise<{ days: string[]; perDayPaise: number; cycleMap?: Map<string, number> }> {
    const start = parseDbDate(inv.start_date);
    if (!start) return { days: [], perDayPaise: 0 };

    const firstDay = istDayKey(start);

    // Monthly plans (Deposit Plan): credit once every month on the start date anniversary
    if (inv.payout_mode === ProfitPayoutMode.MONTHLY) {
      const dueDates = monthlyDueDates(firstDay, inv.duration_days, lastDay);
      if (dueDates.length === 0) return { days: [], perDayPaise: 0 };

      const already = await ProfitCredit.findAll({
        where: { investment_id: inv.id, credit_day: { [Op.in]: dueDates.map((d) => d.dayKey) } },
        attributes: ['credit_day'],
      });
      const paid = new Set(already.map((c) => String(c.credit_day)));
      const perMonthPaise = percentOfPaise(toPaise(inv.amount), inv.profit_value);
      const unpaid = dueDates.filter((d) => !paid.has(d.dayKey));
      return {
        days: unpaid.map((d) => d.dayKey),
        perDayPaise: perMonthPaise,
        cycleMap: new Map(unpaid.map((d) => [d.dayKey, d.monthNo])),
      };
    }

    // Daily plans: first 20 working days of each 30-day cycle, and for fixed terms whole
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
   * Credits every unpaid profit day/month of one investment up to `lastDay` (inclusive). Used by the
   * daily run and by the maturity flow, which settles the final days before returning the
   * capital. Returns the number of credits made and their total.
   */
  public static async creditInvestmentUpTo(
    inv: Investment,
    lastDay: string
  ): Promise<{ count: number; paise: number; days: string[] }> {
    if (inv.payout_mode !== ProfitPayoutMode.DAILY && inv.payout_mode !== ProfitPayoutMode.MONTHLY) {
      return { count: 0, paise: 0, days: [] };
    }

    const { days, perDayPaise, cycleMap } = await this.unpaidDays(inv, lastDay);
    if (days.length === 0 || perDayPaise <= 0) return { count: 0, paise: 0, days: [] };

    const startKey = istDayKey(parseDbDate(inv.start_date)!);
    const credited: string[] = [];
    for (const day of days) {
      const cycleNo = cycleMap?.get(day) ?? cycleNoForDay(startKey, day);
      if (await this.creditOneDay(inv, day, cycleNo, perDayPaise)) credited.push(day);
    }
    return { count: credited.length, paise: credited.length * perDayPaise, days: credited };
  }

  private static async creditDailyProfit(payableDay: string): Promise<{ count: number; paise: number }> {
    // Investments that can still earn on some day <= payableDay. Matured / withdrawal-requested
    // investments are included so that days missed while the server was down are still paid.
    const investments = await Investment.findAll({
      where: {
        payout_mode: { [Op.in]: [ProfitPayoutMode.DAILY, ProfitPayoutMode.MONTHLY] },
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
      const dayText =
        days.length === 1 ? `for ${days[0]}` : `for ${days.length} period(s) (${days[0]} to ${days[days.length - 1]})`;
      await NotificationService.notify({
        userId,
        type: NotificationType.PROFIT_CREDITED,
        title: 'Profit credited',
        message: `${formatInr(fromPaise(entry.paise))} profit ${dayText} has been credited to your profit wallet from ${
          entry.investments.size === 1 ? `investment ${[...entry.investments][0]}` : `${entry.investments.size} investments`
        }. You can withdraw it any time.`,
        relatedEntity: 'WALLET',
      });
    }

    return { count, paise };
  }

  /**
   * Credits one profit credit for one investment atomically. Returns false when another
   * run already credited that day (unique key) so nothing is paid twice.
   */
  private static async creditOneDay(
    inv: Investment,
    day: string,
    cycleNo: number,
    perDayPaise: number
  ): Promise<boolean> {
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

        const isMonthly = inv.payout_mode === ProfitPayoutMode.MONTHLY;
        const description = isMonthly
          ? `Monthly profit (cycle ${cycleNo}) for ${day} on investment ${inv.reference} (${inv.plan_name})`
          : `Daily profit for ${day} on investment ${inv.reference} (${inv.plan_name})`;

        const txn = await WalletService.applyEntry(
          {
            userId: inv.user_id,
            type: WalletTxnType.PROFIT,
            direction: WalletTxnDirection.CREDIT,
            bucket: WalletBucket.PROFIT,
            amountPaise: perDayPaise,
            description,
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

  /**
   * Daily recurring referral commissions: on every paying working day of a referred customer's
   * investment, the referrer receives dailyReferralCommissionPercent of the invested amount
   * (default 0.025% = 0.5% / month) in their PROFIT wallet. The paying days follow the same
   * calendar as daily profit: Mon-Fri after the start day, at most 20 credits per 30-day cycle
   * and whole months over a fixed term (365 days = 240 credits = 12 x 0.5%), up to the
   * maturity day or the withdrawal request. Idempotent per (investment_id, credit_day).
   */
  private static async creditDailyReferralCommissions(
    payableDay: string,
    _now: Date
  ): Promise<{ count: number; paise: number }> {
    const settings = await SettingsService.getSettings();
    if (settings.dailyReferralCommissionPercent <= 0) return { count: 0, paise: 0 };

    // All investments that may earn recurring referral commissions
    const investments = await Investment.findAll({
      where: {
        status: {
          [Op.in]: [InvestmentStatus.ACTIVE, InvestmentStatus.MATURED, InvestmentStatus.WITHDRAWAL_REQUESTED],
        },
      },
      order: [['id', 'ASC']],
    });

    let count = 0;
    let totalPaise = 0;
    const perReferrer = new Map<number, { paise: number; count: number }>();

    for (const inv of investments) {
      const lastDay = await this.lastEarningDay(inv, payableDay);
      const result = await this.creditReferralCommissionUpTo(inv, lastDay);
      if (result.count === 0 || result.referrerUserId === null) continue;
      count += result.count;
      totalPaise += result.paise;
      const cur = perReferrer.get(result.referrerUserId) ?? { paise: 0, count: 0 };
      cur.paise += result.paise;
      cur.count += result.count;
      perReferrer.set(result.referrerUserId, cur);
    }

    // One notification per referrer per run
    for (const [referrerUserId, summary] of perReferrer) {
      await this.notifyDailyReferralCommission(referrerUserId, summary.paise, summary.count);
    }

    return { count, paise: totalPaise };
  }

  /**
   * Credits every unpaid daily referral commission of one investment up to `lastDay`
   * (inclusive) to the referrer's profit wallet. Used by the daily run and by the maturity
   * and withdrawal flows, which settle the last days before the investment is closed and
   * leaves the daily run's query. Returns nothing to pay when the investor was not referred,
   * the referrer is no longer an active customer, or the feature is switched off.
   */
  public static async creditReferralCommissionUpTo(
    inv: Investment,
    lastDay: string,
    options: { notify?: boolean } = {}
  ): Promise<{ count: number; paise: number; referrerUserId: number | null }> {
    const none = { count: 0, paise: 0, referrerUserId: null };
    const settings = await SettingsService.getSettings();
    if (settings.dailyReferralCommissionPercent <= 0) return none;

    const start = parseDbDate(inv.start_date);
    if (!start) return none;

    const referral = await Referral.findOne({ where: { referred_user_id: inv.user_id } });
    if (!referral) return none;

    const referrer = await User.findByPk(referral.referrer_user_id, { attributes: ['id', 'status', 'role'] });
    if (!referrer || referrer.status !== UserStatus.ACTIVE || referrer.role !== UserRole.CUSTOMER) return none;

    // Same paying calendar as daily profit: 20 credits a month, whole months over the term
    const firstDay = istDayKey(start);
    const payingDays = payableWorkingDays(
      firstDay,
      lastDay,
      WORKING_DAYS_PER_MONTH,
      maxCreditsForTerm(Number(inv.duration_days) || 0)
    );
    if (payingDays.length === 0) return none;

    const already = await ReferralDailyCredit.findAll({
      where: { investment_id: inv.id, credit_day: { [Op.in]: payingDays } },
      attributes: ['credit_day'],
    });
    const paidDays = new Set(already.map((c) => String(c.credit_day)));
    const dueDays = payingDays.filter((d) => !paidDays.has(d));
    if (dueDays.length === 0) return none;

    const dailyCommissionPaise = percentOfPaise(toPaise(inv.amount), settings.dailyReferralCommissionPercent);
    if (dailyCommissionPaise <= 0) return none;

    let count = 0;
    for (const day of dueDays) {
      try {
        await sequelize.transaction(async (t) => {
          const credit = await ReferralDailyCredit.create(
            {
              investment_id: inv.id,
              referrer_user_id: referral.referrer_user_id,
              referred_user_id: inv.user_id,
              credit_day: day,
              commission_percent: settings.dailyReferralCommissionPercent,
              amount: fromPaise(dailyCommissionPaise),
            },
            { transaction: t }
          );

          const txn = await WalletService.applyEntry(
            {
              userId: referral.referrer_user_id,
              type: WalletTxnType.REFERRAL_COMMISSION,
              direction: WalletTxnDirection.CREDIT,
              bucket: WalletBucket.PROFIT,
              amountPaise: dailyCommissionPaise,
              description: `Daily referral commission (${settings.dailyReferralCommissionPercent}%) for ${day} on investment ${inv.reference} by referred customer #${inv.user_id}`,
              relatedEntity: 'REFERRAL_DAILY_CREDIT',
              relatedId: credit.id,
            },
            t
          );

          credit.wallet_transaction_id = txn.id;
          await credit.save({ transaction: t });
        });
        count += 1;
      } catch (err: any) {
        // Another run credited this day in the meantime: nothing is paid twice
        if (err?.name === 'SequelizeUniqueConstraintError') continue;
        logger.error(`[PAYOUT] Failed to credit daily referral commission for ${day} on investment ${inv.reference}`, err);
      }
    }

    const paise = count * dailyCommissionPaise;
    if (count > 0 && options.notify) {
      await this.notifyDailyReferralCommission(referral.referrer_user_id, paise, count);
    }
    return { count, paise, referrerUserId: referral.referrer_user_id };
  }

  private static async notifyDailyReferralCommission(referrerUserId: number, paise: number, count: number): Promise<void> {
    await NotificationService.notify({
      userId: referrerUserId,
      type: NotificationType.REFERRAL_COMMISSION,
      title: 'Daily referral commission credited',
      message: `${formatInr(fromPaise(paise))} daily referral commission for ${count} working day${
        count === 1 ? '' : 's'
      } has been credited to your profit wallet.`,
      relatedEntity: 'WALLET',
    });
  }

  /** Human readable description of the payout schedule, for API responses */
  public static scheduleDescription(): string {
    return `Every working day (Monday to Friday) at ${PAYOUT_HOUR_IST}:00 AM IST`;
  }
}
