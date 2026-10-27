import { DataTypes, Op } from 'sequelize';
import { sequelize, Investment, SystemSetting, KycProfile, UserPayoutDetail, Withdrawal } from '../../models/index.js';
import { decryptData } from '../../utils/encryption.js';
import { identityHash } from '../../utils/identityHash.js';
import { logger } from '../../utils/logger.js';
import { BankSource, InvestmentStatus, KycStatus, ProfitPayoutMode, RateBasis, WalletBucket, WalletTxnType, WithdrawalSource } from '../../types/index.js';
import { toPaise, fromPaise } from '../../utils/money.js';
import { parseDbDate } from '../../utils/dates.js';
import { calculateProfitPaise } from '../../services/investmentPlanService.js';

type ColumnDefinition = Parameters<ReturnType<typeof sequelize.getQueryInterface>['addColumn']>[2];

interface ColumnPatch {
  table: string;
  column: string;
  definition: ColumnDefinition;
  /**
   * Raw SQL run once, right after the column is added, to fill it for existing rows.
   * Fresh databases have no rows, so the backfill is harmless there.
   */
  backfill?: string[];
}

interface ColumnChange {
  table: string;
  column: string;
  /** Applied with changeColumn when `needsChange(current)` returns true */
  definition: ColumnDefinition;
  needsChange: (current: Record<string, any>) => boolean;
  reason: string;
}

/**
 * Columns added after the first release. `sequelize.sync()` only creates missing
 * tables, so existing databases get new columns from here. Idempotent.
 */
const COLUMN_PATCHES: ColumnPatch[] = [
  // Duplicate-identity detection across accounts (filled from the encrypted PAN at startup)
  {
    table: 'kyc_profiles',
    column: 'pan_hash',
    definition: { type: DataTypes.STRING(64), allowNull: true },
  },
  // Aadhaar back side (front or e-Aadhaar PDF stays in aadhaar_document)
  {
    table: 'kyc_profiles',
    column: 'aadhaar_back_document',
    definition: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    table: 'investment_plans',
    column: 'is_featured',
    definition: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    table: 'investment_plans',
    column: 'featured_tagline',
    definition: { type: DataTypes.STRING(160), allowNull: true },
  },
  // Bank-transfer top-ups
  {
    table: 'deposits',
    column: 'payment_method',
    definition: { type: DataTypes.ENUM('UPI', 'BANK_TRANSFER'), allowNull: false, defaultValue: 'UPI' },
  },
  // Daily-profit plans
  {
    table: 'investment_plans',
    column: 'payout_mode',
    definition: {
      type: DataTypes.ENUM(...Object.values(ProfitPayoutMode)),
      allowNull: false,
      defaultValue: ProfitPayoutMode.AT_MATURITY,
    },
  },
  {
    table: 'investments',
    column: 'payout_mode',
    definition: {
      type: DataTypes.ENUM(...Object.values(ProfitPayoutMode)),
      allowNull: false,
      defaultValue: ProfitPayoutMode.AT_MATURITY,
    },
  },
  {
    table: 'investments',
    column: 'profit_credited',
    definition: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  },
  // Wallet-balance withdrawals
  {
    table: 'withdrawals',
    column: 'source',
    definition: {
      type: DataTypes.ENUM(...Object.values(WithdrawalSource)),
      allowNull: false,
      defaultValue: WithdrawalSource.INVESTMENT,
    },
  },

  // -------------------------------------------------------------------------
  // Monthly-rate plans, lock-in, capital withdrawal fee
  // Existing DAILY rows were created when profit_value meant "% per working day";
  // they keep that meaning (PER_DAY) so running investments are unchanged.
  // -------------------------------------------------------------------------
  {
    table: 'investment_plans',
    column: 'rate_basis',
    definition: {
      type: DataTypes.ENUM(...Object.values(RateBasis)),
      allowNull: false,
      defaultValue: RateBasis.PER_MONTH,
    },
    backfill: [
      `UPDATE investment_plans SET rate_basis = '${RateBasis.PER_DAY}' WHERE payout_mode = '${ProfitPayoutMode.DAILY}'`,
    ],
  },
  {
    table: 'investment_plans',
    column: 'lock_in_days',
    definition: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Older plans could only be withdrawn at maturity
    backfill: ['UPDATE investment_plans SET lock_in_days = duration_days'],
  },
  {
    table: 'investments',
    column: 'rate_basis',
    definition: {
      type: DataTypes.ENUM(...Object.values(RateBasis)),
      allowNull: false,
      defaultValue: RateBasis.PER_MONTH,
    },
    backfill: [`UPDATE investments SET rate_basis = '${RateBasis.PER_DAY}' WHERE payout_mode = '${ProfitPayoutMode.DAILY}'`],
  },
  {
    table: 'investments',
    column: 'lock_in_days',
    definition: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    backfill: ['UPDATE investments SET lock_in_days = duration_days'],
  },
  {
    table: 'investments',
    column: 'fee_percent',
    definition: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    // The capital withdrawal fee applies to every capital payout
    backfill: ['UPDATE investments SET fee_percent = 5'],
  },

  // Two-bucket wallet
  {
    table: 'wallets',
    column: 'capital_balance',
    definition: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  },
  {
    table: 'wallets',
    column: 'profit_balance',
    definition: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    // Until now the single balance held daily profit, commissions and refunds
    backfill: ['UPDATE wallets SET profit_balance = balance'],
  },
  {
    table: 'wallet_transactions',
    column: 'bucket',
    definition: {
      type: DataTypes.ENUM(...Object.values(WalletBucket)),
      allowNull: false,
      defaultValue: WalletBucket.PROFIT,
    },
    backfill: [
      `UPDATE wallet_transactions SET bucket = '${WalletBucket.CAPITAL}' WHERE type IN ('${WalletTxnType.DEPOSIT}', '${WalletTxnType.INVESTMENT}', '${WalletTxnType.MATURITY_PRINCIPAL}', '${WalletTxnType.REFUND}')`,
      `UPDATE wallet_transactions SET bucket = '${WalletBucket.CAPITAL}' WHERE type = '${WalletTxnType.WITHDRAWAL}' AND related_entity = 'WITHDRAWAL' AND related_id IN (SELECT id FROM withdrawals WHERE source = '${WithdrawalSource.INVESTMENT}')`,
    ],
  },
  {
    table: 'withdrawals',
    column: 'bucket',
    definition: {
      type: DataTypes.ENUM(...Object.values(WalletBucket)),
      allowNull: false,
      defaultValue: WalletBucket.CAPITAL,
    },
    backfill: [`UPDATE withdrawals SET bucket = '${WalletBucket.PROFIT}' WHERE source = '${WithdrawalSource.WALLET}'`],
  },
  {
    table: 'withdrawals',
    column: 'fee_percent',
    definition: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  },
  {
    table: 'withdrawals',
    column: 'fee_amount',
    definition: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  },
  {
    table: 'withdrawals',
    column: 'net_amount',
    definition: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    backfill: ['UPDATE withdrawals SET net_amount = total_amount'],
  },
  {
    table: 'profit_credits',
    column: 'cycle_no',
    definition: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    backfill: [
      // MySQL syntax; on other dialects legacy rows simply keep cycle 0 (display only)
      'UPDATE profit_credits pc JOIN investments i ON i.id = pc.investment_id SET pc.cycle_no = FLOOR(DATEDIFF(pc.credit_day, DATE(i.start_date)) / 30)',
    ],
  },
  // Public customer number (MT + 6 digits derived from the user id, so it is unique without a counter)
  {
    table: 'customer_profiles',
    column: 'customer_id',
    definition: { type: DataTypes.STRING(16), allowNull: true },
    backfill: [
      "UPDATE customer_profiles SET customer_id = CONCAT('MT', LPAD(user_id + 100000, 6, '0')) WHERE customer_id IS NULL",
      'ALTER TABLE customer_profiles ADD UNIQUE INDEX customer_profiles_customer_id (customer_id)',
    ],
  },
  // Bank branch on KYC, saved payout details and the payout snapshot of a withdrawal
  {
    table: 'kyc_profiles',
    column: 'bank_branch',
    definition: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    table: 'user_payout_details',
    column: 'bank_branch',
    definition: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    table: 'withdrawals',
    column: 'payout_bank_branch',
    definition: { type: DataTypes.STRING(100), allowNull: true },
  },
  // Bank name on KYC; bank account fingerprints so accounts can be compared without decrypting;
  // where the payout account came from (KYC / approved change / self-entered)
  {
    table: 'kyc_profiles',
    column: 'bank_name',
    definition: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    table: 'kyc_profiles',
    column: 'bank_account_hash',
    definition: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    table: 'user_payout_details',
    column: 'account_hash',
    definition: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    table: 'user_payout_details',
    column: 'bank_source',
    definition: { type: DataTypes.STRING(20), allowNull: true },
  },
  {
    table: 'user_payout_details',
    column: 'bank_verified_at',
    definition: { type: DataTypes.DATE, allowNull: true },
  },
  {
    table: 'user_payout_details',
    column: 'bank_change_request_id',
    definition: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    table: 'withdrawals',
    column: 'payout_account_hash',
    definition: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    table: 'withdrawals',
    column: 'payout_bank_source',
    definition: { type: DataTypes.STRING(20), allowNull: true },
  },
];

/**
 * Existing columns whose definition changed. Each change is checked against
 * the live column description so it only runs when actually needed.
 */
const COLUMN_CHANGES: ColumnChange[] = [
  {
    table: 'withdrawals',
    column: 'investment_id',
    definition: { type: DataTypes.INTEGER, allowNull: true },
    needsChange: (current) => current.allowNull === false,
    reason: 'wallet withdrawals have no linked investment',
  },
  {
    table: 'wallet_transactions',
    column: 'type',
    definition: { type: DataTypes.ENUM(...Object.values(WalletTxnType)), allowNull: false },
    // MySQL describes an ENUM as "ENUM('A','B',...)"; add the new member when it is missing
    needsChange: (current) =>
      typeof current.type === 'string' &&
      current.type.toUpperCase().startsWith('ENUM') &&
      !current.type.includes(WalletTxnType.REFERRAL_COMMISSION),
    reason: 'new REFERRAL_COMMISSION ledger type',
  },
  {
    table: 'investments',
    column: 'maturity_date',
    definition: { type: DataTypes.DATE, allowNull: true },
    needsChange: (current) => current.allowNull === false,
    reason: 'open-ended investments have no maturity date',
  },
  {
    table: 'investment_plans',
    column: 'payout_mode',
    definition: {
      type: DataTypes.ENUM(...Object.values(ProfitPayoutMode)),
      allowNull: false,
      defaultValue: ProfitPayoutMode.AT_MATURITY,
    },
    needsChange: (current) =>
      typeof current.type === 'string' &&
      current.type.toUpperCase().startsWith('ENUM') &&
      !current.type.includes(ProfitPayoutMode.MONTHLY),
    reason: 'support MONTHLY payout mode on investment plans',
  },
  {
    table: 'investments',
    column: 'payout_mode',
    definition: {
      type: DataTypes.ENUM(...Object.values(ProfitPayoutMode)),
      allowNull: false,
      defaultValue: ProfitPayoutMode.AT_MATURITY,
    },
    needsChange: (current) =>
      typeof current.type === 'string' &&
      current.type.toUpperCase().startsWith('ENUM') &&
      !current.type.includes(ProfitPayoutMode.MONTHLY),
    reason: 'support MONTHLY payout mode on investments',
  },
];

/**
 * Must run BEFORE `sequelize.sync()`: sync creates indexes on new columns and
 * fails if the column is missing. Tables that do not exist yet are skipped;
 * sync creates them complete.
 */
export async function applySchemaPatches(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  const existingTables = new Set(
    (await queryInterface.showAllTables()).map((t: any) => (typeof t === 'string' ? t : t.tableName))
  );
  const described = new Map<string, Record<string, any>>();

  const describe = async (table: string) => {
    if (!described.has(table)) {
      described.set(table, await queryInterface.describeTable(table));
    }
    return described.get(table)!;
  };

  for (const patch of COLUMN_PATCHES) {
    if (!existingTables.has(patch.table)) continue;
    const columns = await describe(patch.table);
    if (columns[patch.column]) continue;

    await queryInterface.addColumn(patch.table, patch.column, patch.definition);
    columns[patch.column] = {};
    logger.info(`[SCHEMA] Added column ${patch.table}.${patch.column}`);

    for (const sql of patch.backfill ?? []) {
      try {
        await sequelize.query(sql);
        logger.info(`[SCHEMA] Backfilled ${patch.table}.${patch.column}`);
      } catch (err) {
        logger.warn(`[SCHEMA] Backfill for ${patch.table}.${patch.column} failed: ${(err as Error).message}`);
      }
    }
  }

  for (const change of COLUMN_CHANGES) {
    if (!existingTables.has(change.table)) continue;
    const columns = await describe(change.table);
    const current = columns[change.column];
    if (!current || !change.needsChange(current)) continue;

    try {
      await queryInterface.changeColumn(change.table, change.column, change.definition);
      logger.info(`[SCHEMA] Changed column ${change.table}.${change.column} (${change.reason})`);
    } catch (err) {
      // SQLite rebuilds the table for changeColumn and may fail on foreign keys; it stores
      // ENUMs as plain TEXT anyway, so the application keeps working.
      logger.warn(`[SCHEMA] Could not change column ${change.table}.${change.column}: ${(err as Error).message}`);
    }
  }
}

/**
 * Data fixes that need the models. Run AFTER `sequelize.sync()` and the seeders. Idempotent:
 * every step only touches rows that still have the old values.
 */
export async function applyDataPatches(): Promise<void> {
  // 1. Lock-ins are no longer used: capital can be withdrawn at any time (closing a running
  //    investment early pays the fee, that is all). Clear them on plans and running investments.
  for (const table of ['investment_plans', 'investments']) {
    try {
      const [, meta] = await sequelize.query(`UPDATE ${table} SET lock_in_days = 0 WHERE lock_in_days > 0`);
      const changed = Number((meta as any)?.affectedRows ?? 0);
      if (changed > 0) logger.info(`[DATA] Cleared the lock-in on ${changed} row(s) of ${table}`);
    } catch (err) {
      logger.warn(`[DATA] Could not clear lock-ins on ${table}: ${(err as Error).message}`);
    }
  }

  // 1b. Fill the PAN fingerprint of KYC records created before the column existed
  try {
    const missing = await KycProfile.findAll({
      where: { pan_hash: null, pan_number_encrypted: { [Op.ne]: null } },
      attributes: ['id', 'pan_number_encrypted', 'pan_hash'],
    });
    let filled = 0;
    for (const kyc of missing) {
      const pan = kyc.pan_number_encrypted ? decryptData(kyc.pan_number_encrypted) : '';
      const hash = identityHash(pan);
      if (!hash) continue;
      kyc.pan_hash = hash;
      await kyc.save();
      filled += 1;
    }
    if (filled > 0) logger.info(`[DATA] Filled the PAN fingerprint on ${filled} KYC record(s)`);
  } catch (err) {
    logger.warn(`[DATA] Could not fill PAN fingerprints: ${(err as Error).message}`);
  }

  // 2. Referral commission is 5% of the referred customer's investment, paid instantly (was 0.5%
  //    after 24 hours). Databases still on the old default move to the new one; a value the admin
  //    changed by hand is left alone.
  try {
    const row = await SystemSetting.findByPk('referral_commission_percent');
    if (row && ['0.5', '0.50', '.5'].includes(String(row.setting_value).trim())) {
      row.setting_value = '5';
      await row.save();
      logger.info('[DATA] Referral commission moved from the old 0.5% default to 5%');
    }
  } catch (err) {
    logger.warn(`[DATA] Could not update the referral commission setting: ${(err as Error).message}`);
  }

  // 3. Plan texts written by the old seed still describe lock-ins and the old fee; refresh
  //    them. Texts the admin edited by hand do not match and are left alone.
  const PLAN_TEXTS: { old: string; next: string; column: 'description' | 'featured_tagline' }[] = [
    {
      column: 'description',
      old: 'Earn 5% of your capital every month, paid into your profit wallet every working day (Monday to Friday) at 6:00 AM as 20 equal credits a month. Withdraw your profit any time. No lock-in: close the plan whenever you like and your capital is returned, less the capital withdrawal fee.',
      next: 'Earn 5% of your capital every month, paid into your profit wallet every working day (Monday to Friday) at 6:00 AM as 20 equal credits a month. Withdraw your profit any time. Close the plan whenever you like; capital withdrawn before the plan ends carries the early withdrawal fee.',
    },
    {
      column: 'description',
      old: 'A one-year plan that earns 6% of your capital every month, paid into your profit wallet every working day (Monday to Friday) at 6:00 AM as 20 equal credits a month. Withdraw your profit any time. Your capital is locked for 365 days and returns to your capital wallet at maturity.',
      next: 'A one-year plan that earns 6% of your capital every month (72% over the year), paid into your profit wallet every working day (Monday to Friday) at 6:00 AM as 20 equal credits a month. Withdraw your profit any time. Your capital returns to your capital wallet at maturity with no fee; you can also close the plan earlier, less the early withdrawal fee.',
    },
    {
      column: 'featured_tagline',
      old: '5% monthly profit, credited every working day. No lock-in.',
      next: '5% monthly profit, credited every working day. Withdraw any time.',
    },
  ];
  for (const text of PLAN_TEXTS) {
    try {
      const [, meta] = await sequelize.query(`UPDATE investment_plans SET ${text.column} = ? WHERE ${text.column} = ?`, {
        replacements: [text.next, text.old],
      });
      const changed = Number((meta as any)?.affectedRows ?? 0);
      if (changed > 0) logger.info(`[DATA] Refreshed the ${text.column} of ${changed} plan(s)`);
    } catch (err) {
      logger.warn(`[DATA] Could not refresh plan ${text.column}: ${(err as Error).message}`);
    }
  }

  // 4. Fixed-term monthly plans pay whole months only (365 days = 240 credits). Re-state the
  //    expected profit of running investments that were created with the old partial-cycle total.
  try {
    const running = await Investment.findAll({
      where: {
        payout_mode: ProfitPayoutMode.DAILY,
        rate_basis: { [Op.ne]: RateBasis.PER_DAY },
        maturity_date: { [Op.ne]: null },
        status: { [Op.in]: [InvestmentStatus.ACTIVE, InvestmentStatus.MATURED, InvestmentStatus.WITHDRAWAL_REQUESTED] },
      },
    });
    let fixed = 0;
    for (const inv of running) {
      const startDate = parseDbDate(inv.start_date);
      const maturityDate = parseDbDate(inv.maturity_date);
      if (!startDate || !maturityDate) continue;
      const amountPaise = toPaise(inv.amount);
      const profitPaise = calculateProfitPaise(inv, amountPaise, { startDate, maturityDate });
      if (profitPaise === toPaise(inv.expected_profit)) continue;
      inv.expected_profit = fromPaise(profitPaise);
      inv.maturity_amount = fromPaise(amountPaise + profitPaise);
      await inv.save();
      fixed += 1;
    }
    if (fixed > 0) logger.info(`[DATA] Re-stated the expected profit of ${fixed} running investment(s) to whole months`);
  } catch (err) {
    logger.warn(`[DATA] Could not re-state expected profits: ${(err as Error).message}`);
  }

  // 5. Deposit Plan pays monthly on start date anniversary (6% / month, 12 credits in a year)
  try {
    const [, meta] = await sequelize.query(
      `UPDATE investment_plans SET payout_mode = 'MONTHLY', rate_basis = 'PER_MONTH', profit_value = 6,
       description = 'A one-year plan that earns 6% of your capital every month (72% over the year), paid into your profit wallet once every month on your investment start date at 6:00 AM. Withdraw your profit any time. Your capital returns to your capital wallet at maturity with no fee; you can also close the plan earlier, less the early withdrawal fee.',
       featured_tagline = '6% monthly profit credited on your start date each month. 1-year term.'
       WHERE name = 'Deposit Plan'`
    );
    const changed = Number((meta as any)?.affectedRows ?? 0);
    if (changed > 0) logger.info(`[DATA] Updated Deposit Plan to MONTHLY payout mode (affected ${changed} row(s))`);
  } catch (err) {
    logger.warn(`[DATA] Could not update Deposit Plan: ${(err as Error).message}`);
  }

  // 6. Initialize daily referral commission setting (default: 0.025% per day = 0.5% / month)
  try {
    const row = await SystemSetting.findByPk('daily_referral_commission_percent');
    if (!row) {
      await SystemSetting.create({
        setting_key: 'daily_referral_commission_percent',
        setting_value: '0.025',
        updated_by: null,
      });
      logger.info('[DATA] Initialized default daily_referral_commission_percent = 0.025%');
    }
  } catch (err) {
    logger.warn(`[DATA] Could not init daily_referral_commission_percent: ${(err as Error).message}`);
  }

  // 7. Bank account fingerprints for records created before the columns existed, and the
  //    source of every saved payout account (KYC when it is the KYC account, else self-entered)
  try {
    const fingerprint = (encrypted: string | null | undefined) => {
      if (!encrypted) return null;
      const plain = decryptData(encrypted);
      return plain ? identityHash(plain) : null;
    };

    const kycs = await KycProfile.findAll({
      where: { bank_account_hash: null, bank_account_number_encrypted: { [Op.ne]: null } },
    });
    for (const kyc of kycs) {
      const hash = fingerprint(kyc.bank_account_number_encrypted);
      if (hash) await kyc.update({ bank_account_hash: hash }, { hooks: false });
    }

    const payouts = await UserPayoutDetail.findAll({
      where: { [Op.or]: [{ account_hash: null }, { bank_source: null }], account_number_encrypted: { [Op.ne]: null } },
    });
    for (const payout of payouts) {
      const hash = payout.account_hash || fingerprint(payout.account_number_encrypted);
      const updates: Record<string, unknown> = { account_hash: hash };
      if (!payout.bank_source) {
        const kyc = await KycProfile.findOne({ where: { user_id: payout.user_id } });
        const sameAsKyc = Boolean(hash && kyc?.bank_account_hash === hash && kyc?.ifsc_code === payout.ifsc_code);
        updates.bank_source = sameAsKyc ? BankSource.KYC : BankSource.CUSTOMER;
        if (sameAsKyc && kyc?.kyc_status === KycStatus.VERIFIED) updates.bank_verified_at = kyc.reviewed_at || new Date();
        if (!payout.bank_name && sameAsKyc && kyc?.bank_name) updates.bank_name = kyc.bank_name;
      }
      await payout.update(updates, { hooks: false });
    }

    const withdrawals = await Withdrawal.findAll({
      where: { payout_account_hash: null, payout_account_number_encrypted: { [Op.ne]: null } },
      attributes: ['id', 'payout_account_number_encrypted'],
    });
    for (const w of withdrawals) {
      const hash = fingerprint(w.payout_account_number_encrypted);
      if (hash) await w.update({ payout_account_hash: hash }, { hooks: false });
    }

    const total = kycs.length + payouts.length + withdrawals.length;
    if (total > 0) logger.info(`[DATA] Filled bank account fingerprints on ${total} record(s)`);
  } catch (err) {
    logger.warn(`[DATA] Could not fill bank account fingerprints: ${(err as Error).message}`);
  }
}

