/** Restores the Regular Plan terms: daily profit on a monthly rate, open-ended, no lock-in. */
import 'dotenv/config';
import { sequelize, InvestmentPlan } from '../src/models/index.js';
import { ProfitPayoutMode, ProfitType, RateBasis } from '../src/types/index.js';

const plan = await InvestmentPlan.findOne({ where: { name: 'Regular Plan' } });
if (!plan) throw new Error('Regular Plan not found');
console.log('before:', { payout_mode: plan.payout_mode, rate_basis: plan.rate_basis, duration_days: plan.duration_days, lock_in_days: plan.lock_in_days, profit_value: plan.profit_value });
plan.payout_mode = ProfitPayoutMode.DAILY;
plan.profit_type = ProfitType.PERCENTAGE;
plan.rate_basis = RateBasis.PER_MONTH;
plan.duration_days = 0;
plan.lock_in_days = 0;
await plan.save();
console.log('after: ', { payout_mode: plan.payout_mode, rate_basis: plan.rate_basis, duration_days: plan.duration_days, lock_in_days: plan.lock_in_days, profit_value: plan.profit_value });
await sequelize.close();
