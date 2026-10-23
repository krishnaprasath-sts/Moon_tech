/**
 * DESTRUCTIVE: deletes the named plans together with every investment made in them and the
 * rows linked to those investments (profit credits, referral commissions, withdrawals). Wallet
 * ledger rows are kept (they are immutable history) but unlinked from the deleted investments.
 * Intended for test data only.
 *   npx tsx scripts/hard-delete-plans.mts "Normal Plan" "Starter 30"
 */
import 'dotenv/config';
import { Op } from 'sequelize';
import {
  sequelize,
  InvestmentPlan,
  Investment,
  ProfitCredit,
  ReferralCommission,
  Withdrawal,
  WalletTransaction,
} from '../src/models/index.js';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: npx tsx scripts/hard-delete-plans.mts "<plan name>" [...]');
  process.exit(1);
}

await sequelize.transaction(async (t) => {
  const plans = await InvestmentPlan.findAll({ where: { name: { [Op.in]: names } }, transaction: t });
  if (plans.length === 0) {
    console.log('No matching plans found');
    return;
  }
  const planIds = plans.map((p) => p.id);
  const investments = await Investment.findAll({ where: { plan_id: { [Op.in]: planIds } }, attributes: ['id'], transaction: t });
  const invIds = investments.map((i) => i.id);

  let credits = 0, commissions = 0, withdrawals = 0, unlinked = 0;
  if (invIds.length > 0) {
    const where = { investment_id: { [Op.in]: invIds } };
    credits = await ProfitCredit.destroy({ where, transaction: t });
    commissions = await ReferralCommission.destroy({ where, transaction: t });
    withdrawals = await Withdrawal.destroy({ where, transaction: t });
    [unlinked] = await WalletTransaction.update(
      { related_entity: 'DELETED_INVESTMENT' },
      { where: { related_entity: 'INVESTMENT', related_id: { [Op.in]: invIds } }, transaction: t }
    );
  }
  const removedInvestments = await Investment.destroy({ where: { id: { [Op.in]: invIds } }, transaction: t });
  const removedPlans = await InvestmentPlan.destroy({ where: { id: { [Op.in]: planIds } }, transaction: t });

  console.log(
    `Deleted plans: ${plans.map((p) => `"${p.name}"`).join(', ')} (${removedPlans})\n` +
      `Deleted investments: ${removedInvestments}, profit credits: ${credits}, referral commissions: ${commissions}, withdrawals: ${withdrawals}\n` +
      `Ledger rows kept and marked DELETED_INVESTMENT: ${unlinked}`
  );
});

const remaining = await InvestmentPlan.findAll({ order: [['id', 'ASC']] });
console.log('Remaining plans:', remaining.map((p) => `#${p.id} ${p.name} (${p.is_active ? 'active' : 'inactive'})`).join(', '));
await sequelize.close();
