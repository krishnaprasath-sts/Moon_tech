import { Op } from 'sequelize';
import { logger } from '../utils/logger.js';
import { PasswordReset, LoginOtp } from '../models/index.js';
import { InvestmentService } from '../services/investmentService.js';
import { DailyPayoutService } from '../services/dailyPayoutService.js';

const MATURITY_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
/**
 * The payout job is idempotent and cheap when nothing is due, so it is polled every
 * minute. That way the 06:00 AM IST run happens within a minute of the hour, and any
 * days missed while the server was down are paid on the next start.
 */
const PAYOUT_CHECK_INTERVAL_MS = 60 * 1000;

let maturityJobRunning = false;

async function runMaturityJob(): Promise<void> {
  if (maturityJobRunning) return;
  maturityJobRunning = true;
  try {
    await InvestmentService.matureDueInvestments();
  } catch (err) {
    logger.error('[CRON] Investment maturity job failed', err);
  } finally {
    maturityJobRunning = false;
  }
}

async function runPayoutJob(): Promise<void> {
  try {
    await DailyPayoutService.run();
  } catch (err) {
    logger.error('[CRON] Daily payout job failed', err);
  }
}

async function runCleanupJob(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await PasswordReset.destroy({ where: { expires_at: { [Op.lt]: cutoff } } });
    await LoginOtp.destroy({ where: { expires_at: { [Op.lt]: cutoff } } });
  } catch (err) {
    logger.error('[CRON] Password reset cleanup job failed', err);
  }
}

/**
 * Background jobs and scheduled tasks
 */
export function initJobs(): void {
  logger.info('Initializing background jobs scheduler...');

  // Move investments past their maturity date to MATURED and notify customers
  runMaturityJob();
  setInterval(runMaturityJob, MATURITY_CHECK_INTERVAL_MS).unref();

  // Daily profit (working days, 06:00 AM IST) and referral commissions (24h after investing)
  runPayoutJob();
  setInterval(runPayoutJob, PAYOUT_CHECK_INTERVAL_MS).unref();

  // Purge expired password reset and login OTPs
  setInterval(runCleanupJob, CLEANUP_INTERVAL_MS).unref();
}
