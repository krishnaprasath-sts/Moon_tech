/**
 * Lists all investment plans, or removes the named legacy plans.
 *   npx tsx scripts/remove-legacy-plans.mts                 -> list
 *   npx tsx scripts/remove-legacy-plans.mts "Normal Plan" "Starter 30"   -> delete those plans
 * A plan with investments is never deleted; it is deactivated and unfeatured instead so the history stays intact.
 */
import 'dotenv/config';
import { sequelize, InvestmentPlan, Investment } from '../src/models/index.js';

const names = process.argv.slice(2);
const plans = await InvestmentPlan.findAll({ order: [['id', 'ASC']] });

for (const p of plans) {
  const count = await Investment.count({ where: { plan_id: p.id } });
  const target = names.some((n) => n.toLowerCase() === p.name.toLowerCase());
  let action = '';
  if (target) {
    if (count === 0) {
      await p.destroy();
      action = 'DELETED';
    } else {
      p.is_active = false;
      p.is_featured = false;
      await p.save();
      action = `KEPT (has investments) -> deactivated`;
    }
  }
  console.log(`#${p.id} "${p.name}" ${p.payout_mode}/${p.rate_basis} ${p.is_active ? 'active' : 'inactive'} ${count} investment(s) ${action}`);
}
await sequelize.close();
