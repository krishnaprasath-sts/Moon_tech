import { Op } from 'sequelize';
import { logger } from '../utils/logger.js';
import { PasswordReset } from '../models/index.js';
import { InvestmentService } from '../services/investmentService.js';

const MATURITY_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

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

async function runCleanupJob(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await PasswordReset.destroy({ where: { expires_at: { [Op.lt]: cutoff } } });
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

  // Purge expired password reset codes
  setInterval(runCleanupJob, CLEANUP_INTERVAL_MS).unref();
}
